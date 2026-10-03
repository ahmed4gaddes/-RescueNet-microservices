using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;

namespace HospitalService;

/// <summary>
/// Consomme mission.completed (exchange topic rescuenet.events) : la réservation devient une admission.
/// RabbitMQ peut être indisponible : on réessaie sans jamais planter le service.
/// </summary>
public class EventConsumer(IServiceScopeFactory scopes, IConfiguration config, ILogger<EventConsumer> logger) : BackgroundService
{
    private const string Exchange = "rescuenet.events";
    private const string Queue = "hospital.mission-completed";

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        var factory = new ConnectionFactory { Uri = new Uri(config["RabbitMq:Url"] ?? "amqp://rescue:rescue123@localhost:5672") };
        while (!ct.IsCancellationRequested)
        {
            try
            {
                await using var conn = await factory.CreateConnectionAsync(ct);
                await using var ch = await conn.CreateChannelAsync(cancellationToken: ct);
                await ch.ExchangeDeclareAsync(Exchange, ExchangeType.Topic, durable: true, cancellationToken: ct);
                await ch.QueueDeclareAsync(Queue, durable: true, exclusive: false, autoDelete: false, cancellationToken: ct);
                await ch.QueueBindAsync(Queue, Exchange, "mission.completed", cancellationToken: ct);

                var consumer = new AsyncEventingBasicConsumer(ch);
                consumer.ReceivedAsync += async (_, ea) =>
                {
                    try
                    {
                        using var doc = JsonDocument.Parse(Encoding.UTF8.GetString(ea.Body.ToArray()));
                        if (doc.RootElement.TryGetProperty("reservationId", out var rid) && Guid.TryParse(rid.GetString(), out var id))
                        {
                            using var scope = scopes.CreateScope();
                            var db = scope.ServiceProvider.GetRequiredService<HospitalDb>();
                            var n = await db.Reservations.Where(r => r.Id == id && r.Status == "RESERVED")
                                .ExecuteUpdateAsync(s => s.SetProperty(r => r.Status, "ADMITTED"), ct);
                            if (n > 0) logger.LogInformation("Réservation {Id} -> ADMITTED", id);
                        }
                        await ch.BasicAckAsync(ea.DeliveryTag, false, ct);
                    }
                    catch (Exception ex)
                    {
                        logger.LogError("Message rejeté: {Msg}", ex.Message);
                        await ch.BasicNackAsync(ea.DeliveryTag, false, false, ct);
                    }
                };
                await ch.BasicConsumeAsync(Queue, autoAck: false, consumer, ct);
                logger.LogInformation("Consommateur RabbitMQ prêt");
                await Task.Delay(Timeout.Infinite, ct);
            }
            catch (OperationCanceledException) { }
            catch (Exception ex)
            {
                logger.LogWarning("RabbitMQ indisponible ({Msg}), nouvelle tentative dans 5s", ex.GetType().Name);
                await Task.Delay(5000, ct).ContinueWith(_ => { });
            }
        }
    }
}
