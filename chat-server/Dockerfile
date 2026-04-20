# ── Stage 1: Build the Binary ──
FROM golang:alpine AS builder

WORKDIR /app

# Download dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy the source code and compile it
COPY *.go ./
# CGO_ENABLED=0 ensures it compiles to a pure, standalone binary
RUN CGO_ENABLED=0 GOOS=linux go build -o chat-server

# ── Stage 2: The Production Image ──
FROM alpine:latest

WORKDIR /app

# Copy ONLY the compiled binary from Stage 1. Leave the source code behind
COPY --from=builder /app/chat-server .

EXPOSE 8081

# Run the binary
CMD ["./chat-server"]
