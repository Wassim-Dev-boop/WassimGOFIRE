package com.cnstn.event.service;

import com.cnstn.event.entity.EventEntity;
import com.cnstn.event.entity.EventOfficialDocumentType;
import com.lowagie.text.Document;
import com.lowagie.text.DocumentException;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.FontFactory;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.Rectangle;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPageEventHelper;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import java.io.ByteArrayOutputStream;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Objects;
import org.springframework.stereotype.Service;

@Service
public class EventOfficialPdfRenderer {

    private static final ZoneId DISPLAY_ZONE = ZoneId.of("Africa/Tunis");
    private static final DateTimeFormatter DATE_TIME_FORMATTER =
            DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm").withZone(DISPLAY_ZONE);

    private static final Font TITLE_FONT = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 15);
    private static final Font SECTION_FONT = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12);
    private static final Font LABEL_FONT = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10);
    private static final Font VALUE_FONT = FontFactory.getFont(FontFactory.HELVETICA, 10);
    private static final Font FOOTER_FONT = FontFactory.getFont(FontFactory.HELVETICA, 9);

    public byte[] renderSubmissionPdf(
            EventEntity event,
            String documentReference,
            int businessVersion,
            String generatedBy,
            String submissionComment,
            Instant generatedAt
    ) {
        Objects.requireNonNull(event);
        Objects.requireNonNull(documentReference);

        try (ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {
            Document document = new Document(PageSize.A4, 36, 36, 84, 58);
            PdfWriter writer = PdfWriter.getInstance(document, outputStream);
            writer.setPageEvent(new DocumentFooter(documentReference, businessVersion));

            document.open();
            addHeader(document, "Formulaire officiel - Evenement", documentReference, businessVersion, generatedAt);
            addEventSection(document, event);

            PdfPTable submissionTable = twoColumnTable();
            addRow(submissionTable, "Soumis par", generatedBy);
            addRow(submissionTable, "Date soumission", formatDate(generatedAt));
            addRow(submissionTable, "Commentaire", normalize(submissionComment, "Aucun commentaire"));
            addSection(document, "Soumission", submissionTable);

            document.close();
            return outputStream.toByteArray();
        } catch (Exception ex) {
            throw new IllegalStateException("Impossible de generer le PDF officiel evenement", ex);
        }
    }

    public byte[] renderDecisionPdf(
            EventEntity event,
            EventOfficialDocumentType documentType,
            String documentReference,
            int businessVersion,
            String generatedBy,
            String decisionRole,
            String decisionName,
            String decisionValue,
            String decisionComment,
            String rejectionReason,
            Instant decisionAt
    ) {
        Objects.requireNonNull(event);
        Objects.requireNonNull(documentType);
        Objects.requireNonNull(documentReference);

        try (ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {
            Document document = new Document(PageSize.A4, 36, 36, 84, 58);
            PdfWriter writer = PdfWriter.getInstance(document, outputStream);
            writer.setPageEvent(new DocumentFooter(documentReference, businessVersion));

            document.open();
            addHeader(document, resolveDecisionTitle(documentType), documentReference, businessVersion, decisionAt);
            addEventSection(document, event);

            PdfPTable decisionTable = twoColumnTable();
            addRow(decisionTable, "Decision", normalize(decisionValue, "N/A"));
            addRow(decisionTable, "Role valideur", normalize(decisionRole, "N/A"));
            addRow(decisionTable, "Nom valideur", normalize(decisionName, generatedBy));
            addRow(decisionTable, "Date decision", formatDate(decisionAt));
            addRow(decisionTable, "Commentaire", normalize(decisionComment, "Aucun commentaire"));
            addRow(decisionTable, "Motif refus", normalize(rejectionReason, "Aucun"));
            addSection(document, "Bloc validation / refus", decisionTable);

            PdfPTable signatureTable = twoColumnTable();
            addRow(signatureTable, "Signature niveau 1", "Validation numerique tracee");
            addRow(signatureTable, "Signataire", normalize(decisionName, generatedBy));
            addRow(signatureTable, "Role", normalize(decisionRole, "N/A"));
            addRow(signatureTable, "Horodatage", formatDate(decisionAt));
            addSection(document, "Signature", signatureTable);

            document.close();
            return outputStream.toByteArray();
        } catch (Exception ex) {
            throw new IllegalStateException("Impossible de generer le PDF de decision evenement", ex);
        }
    }

    private void addHeader(
            Document document,
            String title,
            String reference,
            int businessVersion,
            Instant generatedAt
    ) throws DocumentException {
        Paragraph organization = new Paragraph("CNSTN - Direction des Systemes Numeriques", LABEL_FONT);
        organization.setAlignment(Element.ALIGN_LEFT);
        organization.setSpacingAfter(8f);
        document.add(organization);

        Paragraph titleParagraph = new Paragraph(title, TITLE_FONT);
        titleParagraph.setAlignment(Element.ALIGN_LEFT);
        titleParagraph.setSpacingAfter(10f);
        document.add(titleParagraph);

        PdfPTable metadata = twoColumnTable();
        addRow(metadata, "Reference", reference);
        addRow(metadata, "Version", "v" + businessVersion);
        addRow(metadata, "Date generation", formatDate(generatedAt));
        addRow(metadata, "Format", "A4 portrait");
        document.add(metadata);
        document.add(new Paragraph(" ", VALUE_FONT));
    }

    private void addEventSection(Document document, EventEntity event) throws DocumentException {
        PdfPTable eventTable = twoColumnTable();
        addRow(eventTable, "Reference evenement", normalize(event.getReferenceCode(), "N/A"));
        addRow(eventTable, "Titre", normalize(event.getTitle(), "N/A"));
        addRow(eventTable, "Type", event.getEventType() == null ? "N/A" : event.getEventType().name());
        addRow(eventTable, "Mode", event.getEventMode() == null ? "N/A" : event.getEventMode().name());
        addRow(eventTable, "Statut", event.getStatus() == null ? "N/A" : event.getStatus().name());
        addRow(eventTable, "Workflow", event.getWorkflowStep() == null ? "N/A" : event.getWorkflowStep().name());
        addRow(eventTable, "Demandeur", normalize(event.getRequestedBy(), "N/A"));
        addRow(eventTable, "Debut", formatDate(event.getStartAt()));
        addRow(eventTable, "Fin", formatDate(event.getEndAt()));
        addRow(eventTable, "Lieu", normalize(event.getLocation(), "N/A"));
        addRow(eventTable, "Version metier", String.valueOf(event.getBusinessVersion()));
        addSection(document, "Donnees evenement", eventTable);

        if (event.getEventMode() != null && event.getEventMode().name().contains("LIGNE")) {
            PdfPTable onlineTable = twoColumnTable();
            addRow(onlineTable, "Provider", normalize(event.getOnlineMeetingProvider(), "N/A"));
            addRow(onlineTable, "Lien reunion", normalize(event.getOnlineMeetingLink(), "N/A"));
            addRow(onlineTable, "Meeting ID", normalize(event.getOnlineMeetingId(), "N/A"));
            addSection(document, "Reunion en ligne", onlineTable);
        }
    }

    private void addSection(Document document, String title, PdfPTable table) throws DocumentException {
        Paragraph sectionTitle = new Paragraph(title, SECTION_FONT);
        sectionTitle.setSpacingBefore(8f);
        sectionTitle.setSpacingAfter(6f);
        document.add(sectionTitle);
        document.add(table);
        document.add(new Paragraph(" ", VALUE_FONT));
    }

    private PdfPTable twoColumnTable() {
        PdfPTable table = new PdfPTable(new float[]{2f, 5f});
        table.setWidthPercentage(100f);
        table.getDefaultCell().setBorder(Rectangle.BOX);
        table.getDefaultCell().setPadding(5f);
        return table;
    }

    private void addRow(PdfPTable table, String label, String value) {
        PdfPCell labelCell = new PdfPCell(new Phrase(label, LABEL_FONT));
        labelCell.setPadding(5f);
        labelCell.setBorder(Rectangle.BOX);
        table.addCell(labelCell);

        PdfPCell valueCell = new PdfPCell(new Phrase(value, VALUE_FONT));
        valueCell.setPadding(5f);
        valueCell.setBorder(Rectangle.BOX);
        table.addCell(valueCell);
    }

    private String resolveDecisionTitle(EventOfficialDocumentType type) {
        return switch (type) {
            case DECISION_MANAGER -> "Decision officielle - Validation manager";
            case DECISION_SECURITE -> "Decision officielle - Validation securite";
            case DECISION_DSN -> "Decision officielle - Validation DSN";
            default -> "Decision officielle - Evenement";
        };
    }

    private String formatDate(Instant instant) {
        if (instant == null) {
            return "N/A";
        }
        return DATE_TIME_FORMATTER.format(instant);
    }

    private String normalize(String value, String fallback) {
        if (value == null || value.trim().isEmpty()) {
            return fallback;
        }
        return value.trim();
    }

    private static final class DocumentFooter extends PdfPageEventHelper {

        private final String reference;
        private final int version;

        private DocumentFooter(String reference, int version) {
            this.reference = reference;
            this.version = version;
        }

        @Override
        public void onEndPage(PdfWriter writer, Document document) {
            PdfPTable footerTable = new PdfPTable(2);
            try {
                footerTable.setTotalWidth(document.getPageSize().getWidth() - 72);
                footerTable.setWidths(new float[]{5f, 2f});

                PdfPCell left = new PdfPCell(new Phrase(
                        "Reference " + reference + " - Version v" + version,
                        FOOTER_FONT
                ));
                left.setBorder(Rectangle.NO_BORDER);
                left.setHorizontalAlignment(Element.ALIGN_LEFT);
                footerTable.addCell(left);

                PdfPCell right = new PdfPCell(new Phrase(
                        "Page " + writer.getPageNumber(),
                        FOOTER_FONT
                ));
                right.setBorder(Rectangle.NO_BORDER);
                right.setHorizontalAlignment(Element.ALIGN_RIGHT);
                footerTable.addCell(right);

                footerTable.writeSelectedRows(0, -1, 36, 34, writer.getDirectContent());
            } catch (DocumentException ex) {
                throw new IllegalStateException("Impossible d ecrire le pied de page PDF", ex);
            }
        }
    }
}
