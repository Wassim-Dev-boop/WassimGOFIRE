package com.cnstn.reporting.client;

import com.cnstn.reporting.dto.GenericPageResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

@FeignClient(name = "intervention-service")
public interface InterventionClient {

    @GetMapping("/api/v1/interventions")
    GenericPageResponse count(@RequestParam("page") int page, @RequestParam("size") int size);
}
