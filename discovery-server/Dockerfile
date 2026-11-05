# Eureka Server — build Maven puis image JRE légère
FROM eclipse-temurin:21-jdk AS build
WORKDIR /app
COPY .mvn .mvn
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw -q -B dependency:go-offline
COPY src src
RUN ./mvnw -q -B -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8761
HEALTHCHECK --interval=10s --timeout=5s --retries=20 --start-period=20s \
  CMD curl -fs http://localhost:8761/actuator/health || exit 1
ENTRYPOINT ["java", "-Xmx256m", "-jar", "app.jar"]
