package com.rescuenet.emergency.remote;

import java.time.Duration;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.client.loadbalancer.LoadBalanced;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

@Configuration
public class HttpConfig {

    /**
     * Builder par défaut (utilisé notamment par le client Eureka lui-même) : surtout PAS load-balancé,
     * sinon Eureka tenterait de résoudre « localhost » comme un nom de service.
     */
    @Bean
    @Primary
    RestClient.Builder plainRestClientBuilder() {
        return RestClient.builder();
    }

    /** Builder résolvant « http://NOM-EUREKA/... » via Eureka + LoadBalancer : aucune URL en dur. */
    @Bean
    @LoadBalanced
    RestClient.Builder loadBalancedRestClientBuilder(
            @Value("${rescuenet.http.connect-timeout}") Duration connectTimeout,
            @Value("${rescuenet.http.read-timeout}") Duration readTimeout) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(connectTimeout);
        factory.setReadTimeout(readTimeout);
        return RestClient.builder().requestFactory(factory);
    }
}
