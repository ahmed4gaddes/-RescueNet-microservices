using HospitalService;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);
var port = builder.Configuration.GetValue("Port", 8084);
builder.WebHost.UseUrls($"http://0.0.0.0:{port}");

builder.Services.AddDbContext<HospitalDb>(o => o.UseSqlServer(
    builder.Configuration.GetConnectionString("Hospital")
    ?? "Server=localhost,1433;Database=hospital_db;User Id=sa;Password=Rescue_123!;TrustServerCertificate=True"));
builder.Services.AddHostedService<EurekaRegistration>();
builder.Services.AddHostedService<EventConsumer>();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
    await HospitalDb.InitializeAsync(scope.ServiceProvider.GetRequiredService<HospitalDb>(), app.Logger);

app.MapGet("/health", () => new { status = "UP" });

app.MapGet("/api/hospitals", async (HospitalDb db) => await db.Hospitals.AsNoTracking().OrderBy(h => h.Id).ToListAsync());

app.MapGet("/api/hospitals/{id:int}", async (int id, HospitalDb db) =>
    await db.Hospitals.FindAsync(id) is { } h ? Results.Ok(h) : Results.NotFound(new { error = "Hôpital introuvable" }));

app.MapGet("/api/hospitals/reservations/{id:guid}", async (Guid id, HospitalDb db) =>
    await db.Reservations.FindAsync(id) is { } r ? Results.Ok(r) : Results.NotFound(new { error = "Réservation introuvable" }));

// Choisit l'hôpital le plus proche ayant la spécialité requise ET un lit libre, puis réserve le lit.
app.MapPost("/api/hospitals/match", async (MatchRequest req, HospitalDb db) =>
{
    var specialty = string.IsNullOrWhiteSpace(req.Specialty) ? "GENERAL" : req.Specialty.ToUpperInvariant();
    var all = await db.Hospitals.AsNoTracking().Where(h => h.AvailableBeds > 0).ToListAsync();

    // Spécialité exacte d'abord ; à défaut, urgences générales (le patient est stabilisé puis transféré)
    var candidates = all.Where(h => h.Has(specialty)).ToList();
    var fallback = candidates.Count == 0;
    if (fallback) candidates = all.Where(h => h.Has("GENERAL")).ToList();

    foreach (var h in candidates.OrderBy(h => Geo.DistanceKm(req.Latitude, req.Longitude, h.Latitude, h.Longitude)))
    {
        // Décrément atomique : évite deux réservations simultanées sur le dernier lit
        var updated = await db.Hospitals.Where(x => x.Id == h.Id && x.AvailableBeds > 0)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.AvailableBeds, x => x.AvailableBeds - 1));
        if (updated == 0) continue;

        var reservation = new BedReservation
        {
            HospitalId = h.Id, MissionId = req.MissionId ?? "", Specialty = specialty, Severity = req.Severity ?? "",
        };
        db.Reservations.Add(reservation);
        await db.SaveChangesAsync();

        return Results.Ok(new
        {
            reservationId = reservation.Id,
            hospital = new { h.Id, h.Name, h.City, h.Latitude, h.Longitude },
            distanceKm = Math.Round(Geo.DistanceKm(req.Latitude, req.Longitude, h.Latitude, h.Longitude), 2),
            specialtyMatched = !fallback,
        });
    }
    return Results.Json(new { error = $"Aucun lit disponible pour {specialty}" }, statusCode: 409);
});

// Compensation de la saga : libère le lit (idempotent)
app.MapDelete("/api/hospitals/reservations/{id:guid}", async (Guid id, HospitalDb db) =>
{
    var released = await db.Reservations.Where(r => r.Id == id && r.Status == "RESERVED")
        .ExecuteUpdateAsync(s => s.SetProperty(r => r.Status, "RELEASED"));
    if (released == 0) return Results.NoContent();
    var hospitalId = await db.Reservations.Where(r => r.Id == id).Select(r => r.HospitalId).FirstAsync();
    await db.Hospitals.Where(h => h.Id == hospitalId && h.AvailableBeds < h.TotalBeds)
        .ExecuteUpdateAsync(s => s.SetProperty(h => h.AvailableBeds, h => h.AvailableBeds + 1));
    return Results.NoContent();
});

app.MapPost("/api/hospitals/reservations/{id:guid}/admit", async (Guid id, HospitalDb db) =>
{
    var n = await db.Reservations.Where(r => r.Id == id && r.Status == "RESERVED")
        .ExecuteUpdateAsync(s => s.SetProperty(r => r.Status, "ADMITTED"));
    return n > 0 ? Results.Ok(new { id, status = "ADMITTED" }) : Results.NotFound(new { error = "Réservation introuvable ou déjà traitée" });
});

app.Run();

record MatchRequest(double Latitude, double Longitude, string? Specialty, string? Severity, string? MissionId);
