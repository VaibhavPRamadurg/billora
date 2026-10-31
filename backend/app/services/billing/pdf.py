"""In-memory PDF rendering from persisted invoice snapshots."""

from __future__ import annotations

from html import escape
from datetime import datetime, timezone
from io import BytesIO
from decimal import Decimal

from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.models import Invoice, User
from app.utils.money import quantize_money


def render_invoice_pdf(invoice: Invoice, customer: User) -> bytes:
    """Render a readable, multi-page invoice using stored values only.

    Invoice totals and item snapshots are displayed exactly as persisted. This
    function intentionally performs no database work or financial recalculation.
    """
    stream = BytesIO()
    document = SimpleDocTemplate(
        stream,
        pagesize=A4,
        rightMargin=16 * mm,
        leftMargin=16 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title=f"Invoice {invoice.invoice_number}",
        author="Billora",
        pageCompression=0,
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "InvoiceTitle", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=22,
        leading=26, textColor=colors.HexColor("#17324D"), spaceAfter=5 * mm,
    )
    detail_style = ParagraphStyle(
        "InvoiceDetail", parent=styles["BodyText"], fontName="Helvetica", fontSize=9,
        leading=12, textColor=colors.HexColor("#334155"),
    )
    table_text = ParagraphStyle(
        "InvoiceTableText", parent=detail_style, fontSize=8, leading=10,
    )
    right_text = ParagraphStyle("InvoiceRightText", parent=table_text, alignment=TA_RIGHT)
    table_header = ParagraphStyle(
        "InvoiceTableHeader", parent=table_text, fontName="Helvetica-Bold", textColor=colors.white,
    )
    table_header_right = ParagraphStyle(
        "InvoiceTableHeaderRight", parent=table_header, alignment=TA_RIGHT,
    )
    heading_style = ParagraphStyle(
        "InvoiceHeading", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=10,
        leading=13, textColor=colors.HexColor("#17324D"), spaceBefore=3 * mm, spaceAfter=2 * mm,
    )

    invoice_date = invoice.issued_at or invoice.created_at
    balance = quantize_money(invoice.total - invoice.amount_paid)
    story = [
        Paragraph("BILLORA", title_style),
        Paragraph("Subscription Management System", detail_style),
        Spacer(1, 5 * mm),
    ]
    metadata = Table(
        [
            [
                Paragraph("<b>Bill to</b><br/>" + escape(customer.email), detail_style),
                Paragraph(
                    "<b>Invoice</b><br/>"
                    f"{escape(invoice.invoice_number)}<br/><br/>"
                    "<b>Invoice date</b><br/>"
                    f"{_format_timestamp(invoice_date)}<br/><br/>"
                    "<b>Billing period</b><br/>"
                    f"{_format_timestamp(invoice.period_start)} - {_format_timestamp(invoice.period_end)}",
                    detail_style,
                ),
            ]
        ],
        colWidths=(85 * mm, 85 * mm),
    )
    metadata.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
        ("LEFTPADDING", (0, 0), (-1, -1), 4 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 3 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3 * mm),
    ]))
    story.extend([metadata, Spacer(1, 6 * mm), Paragraph("Invoice items", heading_style)])

    rows = [[
        Paragraph("Description", table_header),
        Paragraph("Qty", table_header_right),
        Paragraph("Unit price", table_header_right),
        Paragraph("Discount", table_header_right),
        Paragraph("Tax", table_header_right),
        Paragraph("Line total", table_header_right),
    ]]
    for item in invoice.items:
        rows.append([
            Paragraph(escape(item.description), table_text),
            Paragraph(_format_quantity(item.quantity), right_text),
            Paragraph(_format_money(invoice.currency, item.unit_price), right_text),
            Paragraph(_format_money(invoice.currency, item.discount_amount), right_text),
            Paragraph(_format_money(invoice.currency, item.tax_amount), right_text),
            Paragraph(_format_money(invoice.currency, item.line_total), right_text),
        ])
    item_table = Table(
        rows,
        colWidths=(52 * mm, 14 * mm, 25 * mm, 23 * mm, 20 * mm, 27 * mm),
        repeatRows=1,
        hAlign="LEFT",
    )
    item_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#17324D")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#CBD5E1")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
        ("LEFTPADDING", (0, 0), (-1, -1), 2 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 2 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2 * mm),
    ]))
    story.extend([item_table, Spacer(1, 5 * mm)])

    total_rows = [
        ["Subtotal", _format_money(invoice.currency, invoice.subtotal)],
        ["Discount", _format_money(invoice.currency, invoice.discount_total)],
        ["Tax", _format_money(invoice.currency, invoice.tax_total)],
        ["Total", _format_money(invoice.currency, invoice.total)],
        ["Amount paid", _format_money(invoice.currency, invoice.amount_paid)],
        ["Outstanding balance", _format_money(invoice.currency, balance)],
    ]
    totals = Table(total_rows, colWidths=(42 * mm, 35 * mm), hAlign="RIGHT")
    totals.setStyle(TableStyle([
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("FONTNAME", (0, 0), (-1, -3), "Helvetica"),
        ("FONTNAME", (0, -2), (-1, -1), "Helvetica-Bold"),
        ("BACKGROUND", (0, -2), (-1, -1), colors.HexColor("#E0F2FE")),
        ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#CBD5E1")),
        ("LEFTPADDING", (0, 0), (-1, -1), 3 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 2 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2 * mm),
    ]))
    story.extend([totals, Spacer(1, 7 * mm), Paragraph("Thank you for your business.", detail_style)])
    document.build(story, onFirstPage=_page_footer, onLaterPages=_page_footer)
    return stream.getvalue()


def _format_money(currency: str, value: Decimal) -> str:
    return f"{currency.upper()} {Decimal(value):,.2f}"


def _format_quantity(value: Decimal) -> str:
    return f"{Decimal(value):,.3f}"


def _format_timestamp(value: datetime) -> str:
    normalized = value.astimezone(timezone.utc) if value.tzinfo else value
    return normalized.strftime("%d %b %Y")


def _page_footer(canvas, document) -> None:
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#64748B"))
    canvas.drawString(document.leftMargin, 10 * mm, "Billora - Invoice")
    canvas.drawRightString(A4[0] - document.rightMargin, 10 * mm, f"Page {document.page}")
    canvas.restoreState()
