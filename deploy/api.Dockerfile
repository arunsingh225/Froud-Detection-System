# Build context: repository root.   docker build -f deploy/api.Dockerfile .
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY src/backend/FraudGuard.Api/FraudGuard.Api.csproj FraudGuard.Api/
RUN dotnet restore FraudGuard.Api/FraudGuard.Api.csproj
COPY src/backend/FraudGuard.Api/ FraudGuard.Api/
RUN dotnet publish FraudGuard.Api/FraudGuard.Api.csproj -c Release -o /out --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /out .
ENV ASPNETCORE_URLS=http://+:5000 ASPNETCORE_ENVIRONMENT=Production
USER app
EXPOSE 5000
ENTRYPOINT ["dotnet", "FraudGuard.Api.dll"]
