using Microsoft.EntityFrameworkCore;

namespace HospitalService;

public class Hospital
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string City { get; set; } = "";
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    /// <summary>Spécialités séparées par des virgules (ex: "GENERAL,CARDIOLOGY").</summary>
    public string Specialties { get; set; } = "GENERAL";
    public int TotalBeds { get; set; }
    public int AvailableBeds { get; set; }

    public bool Has(string specialty) =>
        Specialties.Split(',', StringSplitOptions.TrimEntries).Contains(specialty, StringComparer.OrdinalIgnoreCase);
}

public class BedReservation
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public int HospitalId { get; set; }
    public string MissionId { get; set; } = "";
    public string Specialty { get; set; } = "";
    public string Severity { get; set; } = "";
    /// <summary>RESERVED | ADMITTED | RELEASED</summary>
    public string Status { get; set; } = "RESERVED";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class HospitalDb(DbContextOptions<HospitalDb> options) : DbContext(options)
{
    public DbSet<Hospital> Hospitals => Set<Hospital>();
    public DbSet<BedReservation> Reservations => Set<BedReservation>();

    public static async Task InitializeAsync(HospitalDb db, ILogger logger)
    {
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                await db.Database.EnsureCreatedAsync();
                break;
            }
            catch (Exception ex) when (attempt < 30)
            {
                logger.LogWarning("SQL Server indisponible ({Attempt}/30): {Msg}", attempt, ex.GetType().Name);
                await Task.Delay(3000);
            }
        }

        if (await db.Hospitals.AnyAsync()) return;
        db.Hospitals.AddRange(
            new Hospital { Name = "Hôpital Charles Nicolle", City = "Tunis", Latitude = 36.8015, Longitude = 10.1700,
                Specialties = "GENERAL,CARDIOLOGY,TRAUMA,NEUROLOGY,PULMONOLOGY", TotalBeds = 20, AvailableBeds = 8 },
            new Hospital { Name = "Hôpital La Rabta", City = "Tunis", Latitude = 36.8065, Longitude = 10.1650,
                Specialties = "GENERAL,CARDIOLOGY,NEUROLOGY", TotalBeds = 15, AvailableBeds = 5 },
            new Hospital { Name = "Hôpital Habib Thameur", City = "Tunis", Latitude = 36.7915, Longitude = 10.1720,
                Specialties = "GENERAL,PULMONOLOGY", TotalBeds = 12, AvailableBeds = 4 },
            new Hospital { Name = "Hôpital Mongi Slim", City = "La Marsa", Latitude = 36.8800, Longitude = 10.3250,
                Specialties = "GENERAL,CARDIOLOGY,TRAUMA", TotalBeds = 14, AvailableBeds = 6 },
            new Hospital { Name = "Hôpital Abderrahmen Mami", City = "Ariana", Latitude = 36.8650, Longitude = 10.1930,
                Specialties = "GENERAL,PULMONOLOGY,NEUROLOGY", TotalBeds = 16, AvailableBeds = 7 },
            new Hospital { Name = "Hôpital Militaire de Tunis", City = "Tunis", Latitude = 36.8190, Longitude = 10.1650,
                Specialties = "GENERAL,TRAUMA,CARDIOLOGY", TotalBeds = 18, AvailableBeds = 9 });
        await db.SaveChangesAsync();
        logger.LogInformation("6 hôpitaux de démo créés");
    }
}

public static class Geo
{
    public static double DistanceKm(double lat1, double lon1, double lat2, double lon2)
    {
        const double r = 6371;
        double ToRad(double d) => d * Math.PI / 180;
        var dLat = ToRad(lat2 - lat1);
        var dLon = ToRad(lon2 - lon1);
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(ToRad(lat1)) * Math.Cos(ToRad(lat2)) * Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        return r * 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
    }
}
