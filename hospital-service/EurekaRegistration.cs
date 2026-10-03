using System.Net;
using System.Text;
using System.Text.Json;

namespace HospitalService;

/// <summary>
/// Client Eureka minimal (REST) : register -> heartbeat toutes les 10 s -> deregister à l'arrêt.
/// Réenregistre automatiquement si Eureka a oublié l'instance (404) ou redémarré.
/// </summary>
public class EurekaRegistration(IConfiguration config, ILogger<EurekaRegistration> logger) : BackgroundService
{
    private readonly HttpClient _http = new() { Timeout = TimeSpan.FromSeconds(5) };
    private readonly string _eureka = (config["Eureka:Url"] ?? "http://localhost:8761/eureka").TrimEnd('/');
    private readonly string _app = "HOSPITAL-SERVICE";
    private readonly int _port = config.GetValue("Port", 8084);
    private string InstanceId => $"hospital-service:{_port}";

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        var registered = false;
        while (!ct.IsCancellationRequested)
        {
            try
            {
                if (!registered)
                {
                    registered = await RegisterAsync(ct);
                    if (registered) logger.LogInformation("Enregistré dans Eureka ({Id})", InstanceId);
                }
                else
                {
                    var res = await _http.PutAsync($"{_eureka}/apps/{_app}/{InstanceId}", null, ct);
                    if (res.StatusCode == HttpStatusCode.NotFound) registered = false;
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                registered = false;
                logger.LogWarning("Eureka injoignable: {Msg}", ex.Message);
            }

            await Task.Delay(TimeSpan.FromSeconds(registered ? 10 : 3), ct).ContinueWith(_ => { });
        }
    }

    private async Task<bool> RegisterAsync(CancellationToken ct)
    {
        var payload = new
        {
            instance = new Dictionary<string, object>
            {
                ["instanceId"] = InstanceId,
                ["hostName"] = "localhost",
                ["app"] = _app,
                ["ipAddr"] = "127.0.0.1",
                ["vipAddress"] = "hospital-service",
                ["status"] = "UP",
                ["port"] = new Dictionary<string, object> { ["$"] = _port, ["@enabled"] = "true" },
                ["securePort"] = new Dictionary<string, object> { ["$"] = 443, ["@enabled"] = "false" },
                ["healthCheckUrl"] = $"http://127.0.0.1:{_port}/health",
                ["statusPageUrl"] = $"http://127.0.0.1:{_port}/health",
                ["homePageUrl"] = $"http://127.0.0.1:{_port}/",
                ["dataCenterInfo"] = new Dictionary<string, object>
                {
                    ["@class"] = "com.netflix.appinfo.InstanceInfo$DefaultDataCenterInfo",
                    ["name"] = "MyOwn",
                },
                ["leaseInfo"] = new Dictionary<string, object>
                {
                    ["renewalIntervalInSecs"] = 10,
                    ["durationInSecs"] = 30,
                },
            },
        };
        var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
        var res = await _http.PostAsync($"{_eureka}/apps/{_app}", content, ct);
        return res.IsSuccessStatusCode;
    }

    public override async Task StopAsync(CancellationToken ct)
    {
        await base.StopAsync(ct);
        try
        {
            await _http.DeleteAsync($"{_eureka}/apps/{_app}/{InstanceId}", ct);
            logger.LogInformation("Désenregistré d'Eureka");
        }
        catch { /* Eureka déjà arrêté */ }
    }
}
