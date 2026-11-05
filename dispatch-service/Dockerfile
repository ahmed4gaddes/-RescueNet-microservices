# dispatch-service (Go / Gin / Redis)
FROM golang:1.27-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /out/dispatch-service .

FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata
COPY --from=build /out/dispatch-service /usr/local/bin/dispatch-service
EXPOSE 8085
ENTRYPOINT ["dispatch-service"]
