
import { useState, type FormEvent } from "react";
import {
  Search,
  Plus,
  X,
  Pencil,
  Send,
  CheckCircle2,
  FileText,
  ChevronLeft,
  ChevronRight,
  Copy,
  Layers,
  Trash2,
} from "lucide-react";

type QuoteStatus = "Draft" | "Sent" | "Accepted" | "Expired";

type QuoteItem = {
  id: number;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
};

type Quotation = {
  id: number;
  number: string;
  customer: string;
  templateId: number;
  templateName: string;
  issueDate: string;
  validUntil: string;
  status: Exclude<QuoteStatus, "Expired">;
  items: QuoteItem[];
};

type TemplateItem = {
  productId: string;
  quantity: number;
  unitPrice: number;
};

type QuotationTemplate = {
  id: number;
  name: string;
  description: string;
  validityDays: number;
  items: TemplateItem[];
};

type FormItem = {
  productId: string;
  quantity: string;
  unitPrice: string;
};

type QuoteForm = {
  customer: string;
  templateId: string;
  issueDate: string;
  validityDays: string;
  items: FormItem[];
};

const PAGE_SIZE = 5;

const customers = [
  "TechCorp Solutions",
  "DataFlow Analytics",
  "CloudSync Inc.",
  "InnovateLab",
  "NextGen Systems",
  "Digital Dynamics",
  "FutureTech Labs",
  "SmartData Group",
];

const products = [
  { id: "P001", name: "BrightCRM", price: 99 },
  { id: "P002", name: "Analytics Pro", price: 149 },
  { id: "P003", name: "Cloud Storage", price: 20 },
  { id: "P004", name: "Support Package", price: 0 },
  { id: "P005", name: "Odoo Integration", price: 560 },
  { id: "P006", name: "Premium Support", price: 199 },
];

const initialTemplates: QuotationTemplate[] = [
  {
    id: 1,
    name: "Enterprise Software Package",
    description: "Standard package for enterprise customers.",
    validityDays: 30,
    items: [
      { productId: "P001", quantity: 10, unitPrice: 99 },
      { productId: "P002", quantity: 5, unitPrice: 149 },
    ],
  },
  {
    id: 2,
    name: "Professional Package",
    description: "Software and storage package for growing teams.",
    validityDays: 15,
    items: [
      { productId: "P001", quantity: 3, unitPrice: 99 },
      { productId: "P003", quantity: 5, unitPrice: 20 },
    ],
  },
  {
    id: 3,
    name: "Support Package",
    description: "Customer support and integration services.",
    validityDays: 7,
    items: [
      { productId: "P004", quantity: 1, unitPrice: 0 },
      { productId: "P006", quantity: 1, unitPrice: 199 },
    ],
  },
];

const initialQuotes: Quotation[] = [
  {
    id: 1,
    number: "QT-2026-0001",
    customer: "TechCorp Solutions",
    templateId: 1,
    templateName: "Enterprise Software Package",
    issueDate: "2026-10-01",
    validUntil: "2026-10-31",
    status: "Sent",
    items: [
      {
        id: 1,
        productId: "P001",
        productName: "BrightCRM",
        quantity: 10,
        unitPrice: 99,
      },
      {
        id: 2,
        productId: "P002",
        productName: "Analytics Pro",
        quantity: 5,
        unitPrice: 149,
      },
    ],
  },
  {
    id: 2,
    number: "QT-2026-0002",
    customer: "DataFlow Analytics",
    templateId: 2,
    templateName: "Professional Package",
    issueDate: "2026-10-15",
    validUntil: "2026-11-14",
    status: "Sent",
    items: [
      {
        id: 1,
        productId: "P001",
        productName: "BrightCRM",
        quantity: 3,
        unitPrice: 99,
      },
      {
        id: 2,
        productId: "P003",
        productName: "Cloud Storage",
        quantity: 5,
        unitPrice: 20,
      },
    ],
  },
  {
    id: 3,
    number: "QT-2026-0003",
    customer: "InnovateLab",
    templateId: 3,
    templateName: "Support Package",
    issueDate: "2026-10-20",
    validUntil: "2026-10-27",
    status: "Accepted",
    items: [
      {
        id: 1,
        productId: "P004",
        productName: "Support Package",
        quantity: 1,
        unitPrice: 0,
      },
      {
        id: 2,
        productId: "P006",
        productName: "Premium Support",
        quantity: 1,
        unitPrice: 199,
      },
    ],
  },
  {
    id: 4,
    number: "QT-2026-0004",
    customer: "CloudSync Inc.",
    templateId: 1,
    templateName: "Enterprise Software Package",
    issueDate: "2026-10-25",
    validUntil: "2026-11-24",
    status: "Draft",
    items: [
      {
        id: 1,
        productId: "P002",
        productName: "Analytics Pro",
        quantity: 2,
        unitPrice: 149,
      },
    ],
  },
  {
    id: 5,
    number: "QT-2026-0005",
    customer: "NextGen Systems",
    templateId: 2,
    templateName: "Professional Package",
    issueDate: "2026-10-05",
    validUntil: "2026-10-20",
    status: "Sent",
    items: [
      {
        id: 1,
        productId: "P001",
        productName: "BrightCRM",
        quantity: 5,
        unitPrice: 99,
      },
    ],
  },
];

const emptyForm: QuoteForm = {
  customer: "",
  templateId: "",
  issueDate: "2026-10-31",
  validityDays: "30",
  items: [
    {
      productId: "P001",
      quantity: "1",
      unitPrice: "99",
    },
  ],
};

function currency(amount: number) {
  return `$${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(date: string) {
  if (!date) return "—";

  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function getValidUntil(issueDate: string, validityDays: number) {
  const date = new Date(`${issueDate}T00:00:00`);
  date.setDate(date.getDate() + validityDays);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getQuoteStatus(quote: Quotation): QuoteStatus {
  const today = new Date();
  const todayString = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");

  if (
    quote.status !== "Accepted" &&
    quote.validUntil < todayString
  ) {
    return "Expired";
  }

  return quote.status;
}

function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  const styles: Record<QuoteStatus, string> = {
    Draft: "bg-slate-100 text-slate-600",
    Sent: "bg-blue-50 text-blue-700",
    Accepted: "bg-emerald-50 text-emerald-700",
    Expired: "bg-red-50 text-red-600",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${styles[status]}`}
    >
      {status}
    </span>
  );
}

export default function Quotations() {
  const [activeTab, setActiveTab] = useState<"Templates" | "Quotes">(
    "Quotes"
  );

  const [quotes, setQuotes] = useState<Quotation[]>(initialQuotes);
  const [templates, setTemplates] = useState<QuotationTemplate[]>(initialTemplates);
    useState<QuotationTemplate[]>(initialTemplates);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<QuoteForm>(emptyForm);
  const [error, setError] = useState("");

  const filteredQuotes = quotes.filter((quote) => {
    const query = search.toLowerCase().trim();
    const status = getQuoteStatus(quote);

    const matchesSearch =
      quote.number.toLowerCase().includes(query) ||
      quote.customer.toLowerCase().includes(query);

    const matchesStatus =
      statusFilter === "All" || status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.max(
    1,
    Math.ceil(filteredQuotes.length / PAGE_SIZE)
  );

  const paginatedQuotes = filteredQuotes.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const quoteTotal = (quote: Quotation) =>
    quote.items.reduce(
      (total, item) => total + item.quantity * item.unitPrice,
      0
    );

  const openAddForm = (template?: QuotationTemplate) => {
    setEditingId(null);

    if (template) {
      setForm({
        customer: "",
        templateId: String(template.id),
        issueDate: "2026-10-31",
        validityDays: String(template.validityDays),
        items: template.items.map((item) => ({
          productId: item.productId,
          quantity: String(item.quantity),
          unitPrice: String(item.unitPrice),
        })),
      });
    } else {
      setForm(emptyForm);
    }

    setError("");
    setShowForm(true);
  };

  const openEditForm = (quote: Quotation) => {
    if (quote.status !== "Draft") return;

    setEditingId(quote.id);

    const template = templates.find(
      (item) => item.id === quote.templateId
    );

    setForm({
      customer: quote.customer,
      templateId: String(quote.templateId),
      issueDate: quote.issueDate,
      validityDays: String(
        template?.validityDays ?? 30
      ),
      items: quote.items.map((item) => ({
        productId: item.productId,
        quantity: String(item.quantity),
        unitPrice: String(item.unitPrice),
      })),
    });

    setError("");
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setError("");
  };

  const handleTemplateChange = (templateId: string) => {
    const template = templates.find(
      (item) => String(item.id) === templateId
    );

    if (!template) {
      setForm((previous) => ({
        ...previous,
        templateId,
      }));
      return;
    }

    setForm((previous) => ({
      ...previous,
      templateId,
      validityDays: String(template.validityDays),
      items: template.items.map((item) => ({
        productId: item.productId,
        quantity: String(item.quantity),
        unitPrice: String(item.unitPrice),
      })),
    }));
  };

  const addItem = () => {
    setForm((previous) => ({
      ...previous,
      items: [
        ...previous.items,
        {
          productId: "P001",
          quantity: "1",
          unitPrice: "99",
        },
      ],
    }));
  };

  const updateItem = (
    index: number,
    field: keyof FormItem,
    value: string
  ) => {
    setForm((previous) => ({
      ...previous,
      items: previous.items.map((item, itemIndex) => {
        if (itemIndex !== index) return item;

        if (field === "productId") {
          const product = products.find(
            (product) => product.id === value
          );

          return {
            ...item,
            productId: value,
            unitPrice: String(product?.price ?? 0),
          };
        }

        return {
          ...item,
          [field]: value,
        };
      }),
    }));
  };

  const removeItem = (index: number) => {
    setForm((previous) => ({
      ...previous,
      items: previous.items.filter(
        (_, itemIndex) => itemIndex !== index
      ),
    }));
  };

  const formTotal = form.items.reduce(
    (total, item) =>
      total +
      Math.max(0, Number(item.quantity) || 0) *
        Math.max(0, Number(item.unitPrice) || 0),
    0
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!form.customer) {
      setError("Please select a customer.");
      return;
    }

    const validityDays = Number(form.validityDays);

    if (
      !Number.isInteger(validityDays) ||
      validityDays < 1
    ) {
      setError("Validity must be at least one whole day.");
      return;
    }

    if (!form.issueDate) {
      setError("Please select an issue date.");
      return;
    }

    if (form.items.length === 0) {
      setError("Add at least one quotation item.");
      return;
    }

    const invalidItem = form.items.some((item) => {
      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unitPrice);

      return (
        !products.some((product) => product.id === item.productId) ||
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        !Number.isFinite(unitPrice) ||
        unitPrice < 0
      );
    });

    if (invalidItem) {
      setError(
        "Check that every item has a valid product, quantity and price."
      );
      return;
    }

    const template = templates.find(
      (item) => String(item.id) === form.templateId
    );

    const items: QuoteItem[] = form.items.map((item, index) => {
      const product = products.find(
        (product) => product.id === item.productId
      )!;

      return {
        id: index + 1,
        productId: product.id,
        productName: product.name,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
      };
    });

    const nextId =
      Math.max(0, ...quotes.map((quote) => quote.id)) + 1;

    const previousQuote = quotes.find(
      (quote) => quote.id === editingId
    );

    const savedQuote: Quotation = {
      id: editingId ?? nextId,
      number:
        previousQuote?.number ??
        `QT-2026-${String(nextId).padStart(4, "0")}`,
      customer: form.customer,
      templateId: template?.id ?? 0,
      templateName: template?.name ?? "Custom Quotation",
      issueDate: form.issueDate,
      validUntil: getValidUntil(form.issueDate, validityDays),
      status: previousQuote?.status ?? "Draft",
      items,
    };

    if (editingId !== null) {
      setQuotes((previous) =>
        previous.map((quote) =>
          quote.id === editingId ? savedQuote : quote
        )
      );
    } else {
      setQuotes((previous) => [savedQuote, ...previous]);
    }

    setCurrentPage(1);
    closeForm();
  };

  const updateQuoteStatus = (
    id: number,
    nextStatus: "Sent" | "Accepted"
  ) => {
    setQuotes((previous) =>
      previous.map((quote) => {
        if (quote.id !== id) return quote;
        if (getQuoteStatus(quote) === "Expired") return quote;

        if (
          nextStatus === "Accepted" &&
          quote.status !== "Sent"
        ) {
          return quote;
        }

        if (
          nextStatus === "Sent" &&
          quote.status !== "Draft"
        ) {
          return quote;
        }

        return {
          ...quote,
          status: nextStatus,
        };
      })
    );
  };

  const deleteDraft = (id: number) => {
    const confirmed = window.confirm(
      "Delete this draft quotation?"
    );

    if (!confirmed) return;

    setQuotes((previous) =>
      previous.filter(
        (quote) =>
          quote.id !== id ||
          quote.status !== "Draft"
      )
    );
  };

  
  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Quotations
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Create and manage quotation templates and customer quotes.
          </p>
        </div>

        {activeTab === "Quotes" && (
          <button
            onClick={() => openAddForm()}
            className="flex items-center justify-center gap-2 self-start rounded-lg bg-yellow-400 px-4 py-2.5 text-xs font-bold text-slate-900 shadow-sm hover:bg-yellow-500"
          >
            <Plus size={16} />
            New Quotation
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-slate-200">
        {(["Templates", "Quotes"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              setSearch("");
              setStatusFilter("All");
              setCurrentPage(1);
            }}
            className={`relative flex items-center gap-2 pb-3 text-sm font-semibold transition ${
              activeTab === tab
                ? "text-amber-800"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {tab === "Templates" ? (
              <Layers size={16} />
            ) : (
              <FileText size={16} />
            )}

            {tab}

            {activeTab === tab && (
              <span className="absolute bottom-0 left-0 h-0.5 w-full bg-yellow-400" />
            )}
          </button>
        ))}
      </div>

      {/* Template listing */}
      {activeTab === "Templates" && (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-800">
                Quotation Templates
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Reusable quotation structures for your sales team.
              </p>
            </div>

            <span className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600">
              {templates.length} templates
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
            {templates.map((template) => (
              <div
                key={template.id}
                className="rounded-xl border border-slate-200 p-5 transition hover:border-yellow-300 hover:shadow-sm"
              >
                <div className="mb-4 flex items-start justify-between">
                  <div className="rounded-lg bg-yellow-50 p-2.5 text-amber-600">
                    <FileText size={20} />
                  </div>

                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-semibold text-blue-700">
                    {template.validityDays} days validity
                  </span>
                </div>

                <h3 className="text-sm font-bold text-slate-800">
                  {template.name}
                </h3>

                <p className="mt-2 min-h-10 text-xs leading-relaxed text-slate-500">
                  {template.description}
                </p>

                <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">
                      Product lines
                    </span>
                    <span className="font-semibold text-slate-700">
                      {template.items.length}
                    </span>
                  </div>

                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">
                      Template total
                    </span>
                    <span className="font-bold text-slate-800">
                      {currency(
                        template.items.reduce(
                          (total, item) =>
                            total + item.quantity * item.unitPrice,
                          0
                        )
                      )}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setActiveTab("Quotes");
                    openAddForm(template);
                  }}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-400 py-2.5 text-xs font-bold text-slate-900 transition hover:bg-yellow-500"
                >
                  <Copy size={14} />
                  Use Template
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Quotes listing */}
      {activeTab === "Quotes" && (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search quotations..."
                className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-xs outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setCurrentPage(1);
              }}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600 outline-none focus:border-yellow-400"
            >
              <option value="All">All statuses</option>
              {(
                ["Draft", "Sent", "Accepted", "Expired"] as QuoteStatus[]
              ).map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left">
              <thead className="bg-slate-50">
                <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="px-5 py-4">Quote Number</th>
                  <th className="px-4 py-4">Customer</th>
                  <th className="px-4 py-4">Valid Until</th>
                  <th className="px-4 py-4">Status</th>
                  <th className="px-4 py-4">Total</th>
                  <th className="px-4 py-4">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {paginatedQuotes.map((quote) => {
                  const status = getQuoteStatus(quote);

                  return (
                    <tr
                      key={quote.id}
                      className="text-xs transition hover:bg-slate-50/70"
                    >
                      <td className="px-5 py-4">
                        <p className="font-semibold text-blue-700">
                          {quote.number}
                        </p>
                        <p className="mt-1 text-[10px] text-slate-400">
                          {quote.templateName}
                        </p>
                      </td>

                      <td className="px-4 py-4 font-medium text-slate-700">
                        {quote.customer}
                      </td>

                      <td className="px-4 py-4 text-slate-500">
                        {formatDate(quote.validUntil)}
                      </td>

                      <td className="px-4 py-4">
                        <QuoteStatusBadge status={status} />
                      </td>

                      <td className="px-4 py-4 font-semibold text-slate-800">
                        {currency(quoteTotal(quote))}
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1">
                          {quote.status === "Draft" && status === "Draft" && (
                            <>
                              <button
                                onClick={() => openEditForm(quote)}
                                title="Edit quotation"
                                className="rounded-md p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                              >
                                <Pencil size={15} />
                              </button>

                              <button
                                onClick={() =>
                                  updateQuoteStatus(quote.id, "Sent")
                                }
                                title="Mark as sent"
                                className="rounded-md p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                              >
                                <Send size={15} />
                              </button>

                              <button
                                onClick={() => deleteDraft(quote.id)}
                                title="Delete draft"
                                className="rounded-md p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                              >
                                <Trash2 size={15} />
                              </button>
                            </>
                          )}

                          {quote.status === "Sent" && status === "Sent" && (
                            <button
                              onClick={() =>
                                updateQuoteStatus(quote.id, "Accepted")
                              }
                              title="Mark as accepted"
                              className="rounded-md p-2 text-emerald-600 hover:bg-emerald-50"
                            >
                              <CheckCircle2 size={16} />
                            </button>
                          )}

                          {status === "Accepted" && (
                            <span className="px-2 text-[10px] font-semibold text-emerald-600">
                              Accepted
                            </span>
                          )}

                          {status === "Expired" && (
                            <span className="px-2 text-[10px] text-red-500">
                              Expired
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {paginatedQuotes.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-16 text-center">
                      <FileText
                        size={30}
                        className="mx-auto mb-3 text-slate-300"
                      />
                      <p className="text-sm font-semibold text-slate-600">
                        No quotations found
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        Try changing your search or filters.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col justify-between gap-3 border-t border-slate-100 px-5 py-3 sm:flex-row sm:items-center">
            <p className="text-[11px] text-slate-400">
              Showing{" "}
              {filteredQuotes.length === 0
                ? 0
                : (currentPage - 1) * PAGE_SIZE + 1}
              –
              {Math.min(
                currentPage * PAGE_SIZE,
                filteredQuotes.length
              )}{" "}
              of {filteredQuotes.length} quotations
            </p>

            <div className="flex items-center gap-1">
              <button
                onClick={() =>
                  setCurrentPage((page) => Math.max(1, page - 1))
                }
                disabled={currentPage === 1}
                aria-label="Previous page"
                className="rounded-md border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-30"
              >
                <ChevronLeft size={15} />
              </button>

              {Array.from({ length: totalPages }, (_, index) => index + 1).map(
                (page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`h-8 min-w-8 rounded-md px-2 text-xs font-semibold ${
                      currentPage === page
                        ? "bg-yellow-400 text-slate-900"
                        : "text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    {page}
                  </button>
                )
              )}

              <button
                onClick={() =>
                  setCurrentPage((page) => Math.min(totalPages, page + 1))
                }
                disabled={currentPage === totalPages}
                aria-label="Next page"
                className="rounded-md border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-30"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Create/Edit Quotation Modal */}
      {showForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-3 sm:p-6">
          <div className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingId !== null
                    ? "Edit Quotation"
                    : "New Quotation"}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Prepare a quotation for your customer.
                </p>
              </div>

              <button
                onClick={closeForm}
                aria-label="Close quotation form"
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-5 overflow-y-auto p-6"
            >
              {/* Customer and template */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-semibold text-slate-700">
                    Customer *
                  </label>
                  <select
                    required
                    value={form.customer}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        customer: event.target.value,
                      })
                    }
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-yellow-400"
                  >
                    <option value="">Select customer</option>
                    {customers.map((customer) => (
                      <option key={customer}>{customer}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold text-slate-700">
                    Quotation Template
                  </label>
                  <select
                    value={form.templateId}
                    onChange={(event) =>
                      handleTemplateChange(event.target.value)
                    }
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-yellow-400"
                  >
                    <option value="">Custom quotation</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold text-slate-700">
                    Issue Date *
                  </label>
                  <input
                    required
                    type="date"
                    value={form.issueDate}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        issueDate: event.target.value,
                      })
                    }
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-yellow-400"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold text-slate-700">
                    Validity (Days) *
                  </label>
                  <input
                    required
                    type="number"
                    min="1"
                    step="1"
                    value={form.validityDays}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        validityDays: event.target.value,
                      })
                    }
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-yellow-400"
                  />
                </div>
              </div>

              {/* Product lines */}
              <div>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">
                      Quotation Items
                    </h3>
                    <p className="mt-1 text-[10px] text-slate-400">
                      Add products and set their quantities and prices.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={addItem}
                    className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    <Plus size={14} />
                    Add Item
                  </button>
                </div>

                <div className="space-y-3">
                  {form.items.map((item, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-1 gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-[1.5fr_0.65fr_0.8fr_auto]"
                    >
                      <div>
                        <label className="mb-1.5 block text-[11px] font-medium text-slate-600">
                          Product
                        </label>
                        <select
                          value={item.productId}
                          onChange={(event) =>
                            updateItem(
                              index,
                              "productId",
                              event.target.value
                            )
                          }
                          className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs outline-none focus:border-yellow-400"
                        >
                          {products.map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-[11px] font-medium text-slate-600">
                          Quantity
                        </label>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={item.quantity}
                          onChange={(event) =>
                            updateItem(
                              index,
                              "quantity",
                              event.target.value
                            )
                          }
                          className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs outline-none focus:border-yellow-400"
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-[11px] font-medium text-slate-600">
                          Unit Price ($)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(event) =>
                            updateItem(
                              index,
                              "unitPrice",
                              event.target.value
                            )
                          }
                          className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs outline-none focus:border-yellow-400"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        disabled={form.items.length === 1}
                        aria-label="Remove quotation item"
                        className="self-end rounded-md p-2 text-red-500 hover:bg-red-50 disabled:opacity-30"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div className="flex justify-end">
                <div className="w-full rounded-lg border border-slate-200 bg-white p-4 sm:w-64">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Subtotal</span>
                    <span className="font-semibold text-slate-700">
                      {currency(formTotal)}
                    </span>
                  </div>

                  <div className="mt-3 flex justify-between border-t border-slate-100 pt-3">
                    <span className="text-sm font-bold text-slate-800">
                      Total
                    </span>
                    <span className="text-lg font-bold text-slate-900">
                      {currency(formTotal)}
                    </span>
                  </div>
                </div>
              </div>

              <p className="rounded-lg bg-blue-50 p-3 text-[11px] leading-relaxed text-blue-700">
                The quotation will be saved as Draft. Its validity end date
                will be calculated from the issue date and validity period.
              </p>

              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
                  {error}
                </p>
              )}

              <div className="flex flex-col-reverse justify-end gap-3 border-t border-slate-100 pt-4 sm:flex-row">
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-lg border border-slate-200 px-5 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="rounded-lg bg-yellow-400 px-5 py-2.5 text-xs font-bold text-slate-900 hover:bg-yellow-500"
                >
                  {editingId !== null
                    ? "Save Changes"
                    : "Save Quotation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
