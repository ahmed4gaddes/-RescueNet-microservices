package com.rescuenet.emergency.events;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitConfig {

    public static final String EXCHANGE = "rescuenet.events";
    public static final String STATUS_QUEUE = "emergency.status-changed";

    @Bean
    TopicExchange rescuenetExchange() {
        return new TopicExchange(EXCHANGE, true, false);
    }

    @Bean
    Queue statusQueue() {
        return new Queue(STATUS_QUEUE, true);
    }

    @Bean
    Binding statusBinding(Queue statusQueue, TopicExchange rescuenetExchange) {
        return BindingBuilder.bind(statusQueue).to(rescuenetExchange).with("mission.status.changed");
    }
}
