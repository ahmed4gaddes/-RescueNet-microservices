using Microsoft.EntityFrameworkCore;

namespace HospitalService;

/// <summary>
/// Sortie automatique des patients : une réservation ADMITTED depuis plus de <c>Hospital:StayMinutes</c> minutes
/// (3 par défaut, variable d'environnement Hospital__StayMinutes) passe en DISCHARGED et le lit est rendu à l'hôpital.
/// Sans cela, les lits ne se libéreraient jamais. La durée se compte depuis la création de la réservation
/// (la mission dure quelques secondes en simulation) : aucun changement de schéma n'est nécessaire.
/// </summary>
public class DischargeService(IServiceScopeFactory scopes, IConfiguration config, ILogger<DischargeService> logger) : BackgroundService
{
    private static readonly TimeSpan Every = TimeSpan.FromSeconds(15);

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        var stay = TimeSpan.FromMinutes(Math.Max(0.1, config.GetValue("Hospital:StayMinutes", 3.0)));
        logger.LogInformation("Sortie automatique des patients après {Stay} min", stay.TotalMinutes);

        while (!ct.IsCancellationRequested)
        {
            try
            {
                await DischargeAsync(stay, ct);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogWarning("Sortie des patients impossible pour l'instant: {Msg}", ex.GetType().Name);
            }
            await Task.Delay(Every, ct).ContinueWith(_ => { });
        }
    }

    private async Task DischargeAsync(TimeSpan stay, CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<HospitalDb>();
        var limit = DateTime.UtcNow - stay;

        var due = await db.Reservations.AsNoTracking()
            .Where(r => r.Status == "ADMITTED" && r.CreatedAt < limit)
            .Select(r => new { r.Id, r.HospitalId })
            .ToListAsync(ct);

        foreach (var r in due)
        {
            // Passage atomique ADMITTED -> DISCHARGED : un lit n'est jamais rendu deux fois
            var changed = await db.Reservations.Where(x => x.Id == r.Id && x.Status == "ADMITTED")
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.Status, "DISCHARGED"), ct);
            if (changed == 0) continue;

            await db.Hospitals.Where(h => h.Id == r.HospitalId && h.AvailableBeds < h.TotalBeds)
                .ExecuteUpdateAsync(s => s.SetProperty(h => h.AvailableBeds, h => h.AvailableBeds + 1), ct);
        }

        if (due.Count > 0) logger.LogInformation("{Count} patient(s) sorti(s), lits libérés", due.Count);
    }
}
