package com.cnstn.reporting.exception;

import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import java.util.Objects;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(AccessDeniedException.class)
    public ProblemDetail handleAccessDenied(AccessDeniedException ex, HttpServletRequest request) {
        ProblemDetail problemDetail = ProblemDetail.forStatusAndDetail(
                HttpStatusCode.valueOf(HttpStatus.FORBIDDEN.value()),
                "Access denied"
        );
        problemDetail.setTitle(HttpStatus.FORBIDDEN.getReasonPhrase());
        problemDetail.setType(Objects.requireNonNull(URI.create("about:blank")));
        problemDetail.setInstance(Objects.requireNonNull(URI.create(Objects.requireNonNull(request.getRequestURI()))));
        return problemDetail;
    }

    @ExceptionHandler(Exception.class)
    public ProblemDetail handleGeneric(Exception ex, HttpServletRequest request) {
        ProblemDetail problemDetail = ProblemDetail.forStatusAndDetail(HttpStatusCode.valueOf(HttpStatus.INTERNAL_SERVER_ERROR.value()), "Unexpected server error");
        problemDetail.setTitle(HttpStatus.INTERNAL_SERVER_ERROR.getReasonPhrase());
        problemDetail.setType(Objects.requireNonNull(URI.create("about:blank")));
        problemDetail.setInstance(Objects.requireNonNull(URI.create(Objects.requireNonNull(request.getRequestURI()))));
        return problemDetail;
    }
}
