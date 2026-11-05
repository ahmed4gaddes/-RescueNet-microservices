# hospital-service (C# / .NET 10 / SQL Server)
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY HospitalService.csproj .
RUN dotnet restore
COPY . .
RUN dotnet publish -c Release -o /out --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /out .
ENV Port=8084
EXPOSE 8084
ENTRYPOINT ["dotnet", "HospitalService.dll"]
