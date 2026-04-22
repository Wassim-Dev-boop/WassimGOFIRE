package com.cnstn.ged.exception;

import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import java.util.Objects;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ResourceNotFoundException.class)
    public ProblemDetail handleNotFound(ResourceNotFoundException ex, HttpServletRequest request) {
        ProblemDetail problemDetail = ProblemDetail.forStatusAndDetail(HttpStatusCode.valueOf(HttpStatus.NOT_FOUND.value()), ex.getMessage());
        problemDetail.setTitle(HttpStatus.NOT_FOUND.getReasonPhrase());
        problemDetail.setType(Objects.requireNonNull(URI.create("about:blank")));
        problemDetail.setInstance(Objects.requireNonNull(URI.create(Objects.requireNonNull(request.getRequestURI()))));
        return problemDetail;
    }
}
