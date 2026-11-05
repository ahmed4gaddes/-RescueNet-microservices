package com.rescuenet.apigateway;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.reactive.EnableWebFluxSecurity;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.ReactiveJwtAuthenticationConverterAdapter;
import org.springframework.security.web.server.SecurityWebFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.reactive.CorsConfigurationSource;
import org.springframework.web.cors.reactive.UrlBasedCorsConfigurationSource;

import reactor.core.publisher.Mono;

/**
 * Sécurité de l'API Gateway : resource server JWT (émis par Keycloak, realm "rescuenet").
 * Les rôles viennent de realm_access.roles et deviennent ROLE_OPERATEUR / ROLE_ADMIN.
 *
 * OPERATEUR : crée et suit les urgences, consulte patients / hôpitaux / ambulances.
 * ADMIN     : tout, y compris le triage IA et la modification des dossiers patients.
 */
@Configuration
@EnableWebFluxSecurity
public class SecurityConfig {

    @Bean
    SecurityWebFilterChain springSecurityFilterChain(ServerHttpSecurity http) {
        return http
                .csrf(ServerHttpSecurity.CsrfSpec::disable)
                .cors(Customizer.withDefaults())
                .authorizeExchange(ex -> ex
                        .pathMatchers(HttpMethod.OPTIONS).permitAll()
                        .pathMatchers("/actuator/health", "/actuator/health/**").permitAll()
                        // Opérateur ou admin
                        .pathMatchers(HttpMethod.POST, "/api/emergencies/**").hasAnyRole("OPERATEUR", "ADMIN")
                        .pathMatchers(HttpMethod.GET, "/api/emergencies/**", "/api/patients/**",
                                "/api/hospitals/**", "/api/dispatch/**").hasAnyRole("OPERATEUR", "ADMIN")
                        // Admin uniquement : triage IA, écriture sur les patients, tout le reste
                        .pathMatchers("/api/triage/**").hasRole("ADMIN")
                        .pathMatchers("/api/patients/**").hasRole("ADMIN")
                        .pathMatchers("/actuator/**").hasRole("ADMIN")
                        .anyExchange().hasRole("ADMIN"))
                .oauth2ResourceServer(o -> o.jwt(j -> j.jwtAuthenticationConverter(converter())))
                .build();
    }

    /** realm_access.roles -> ROLE_xxx */
    private Converter<Jwt, Mono<AbstractAuthenticationToken>> converter() {
        JwtAuthenticationConverter delegate = new JwtAuthenticationConverter();
        delegate.setJwtGrantedAuthoritiesConverter(SecurityConfig::realmRoles);
        return new ReactiveJwtAuthenticationConverterAdapter(delegate);
    }

    @SuppressWarnings("unchecked")
    private static Collection<GrantedAuthority> realmRoles(Jwt jwt) {
        Object realm = jwt.getClaim("realm_access");
        if (realm instanceof Map<?, ?> m && m.get("roles") instanceof List<?> roles) {
            return roles.stream()
                    .map(r -> (GrantedAuthority) new SimpleGrantedAuthority("ROLE_" + r))
                    .collect(Collectors.toList());
        }
        return List.of();
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration cfg = new CorsConfiguration();
        cfg.setAllowedOriginPatterns(List.of("http://localhost:*", "http://127.0.0.1:*"));
        cfg.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        cfg.setAllowedHeaders(List.of("*"));
        cfg.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", cfg);
        return source;
    }
}
