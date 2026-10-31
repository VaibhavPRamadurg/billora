
import { useState, type FormEvent } from "react";
import {
  Search,
  Plus,
  Filter,
  Pencil,
  Archive,
  X,
  Trash2,
  Package,
} from "lucide-react";

type ProductVariant = {
  id: number;
  name: string;
  priceAdjustment: number;
};

type Product = {
  id: number;
  name: string;
  type: string;
  salesPrice: number;
  costPrice: number;
  notes: string;
  variants: ProductVariant[];
  status: "Active" | "Archived";
};

type VariantForm = {
  name: string;
  priceAdjustment: string;
};

type ProductForm = {
  name: string;
  type: string;
  salesPrice: string;
  costPrice: string;
  notes: string;
  variants: VariantForm[];
};

const initialProducts: Product[] = [
  {
    id: 1,
    name: "BrightCRM",
    type: "Software",
    salesPrice: 99,
    costPrice: 40,
    notes: "CRM platform for businesses",
    variants: [],
    status: "Active",
  },
  {
    id: 2,
    name: "Analytics Pro",
    type: "Software",
    salesPrice: 149,
    costPrice: 65,
    notes: "Advanced business analytics",
    variants: [],
    status: "Active",
  },
  {
    id: 3,
    name: "Cloud Storage",
    type: "Add-on",
    salesPrice: 20,
    costPrice: 8,
    notes: "Additional cloud storage",
    variants: [],
    status: "Active",
  },
  {
    id: 4,
    name: "Support Package",
    type: "Service",
    salesPrice: 0,
    costPrice: 0,
    notes: "Standard customer support",
    variants: [],
    status: "Active",
  },
  {
    id: 5,
    name: "Odoo Integration",
    type: "Software",
    salesPrice: 560,
    costPrice: 200,
    notes: "Third-party Odoo integration",
    variants: [],
    status: "Active",
  },
  {
    id: 6,
    name: "Premium Support",
    type: "Service",
    salesPrice: 199,
    costPrice: 80,
    notes: "Priority technical support",
    variants: [],
    status: "Archived",
  },
];

const emptyForm: ProductForm = {
  name: "",
  type: "Software",
  salesPrice: "",
  costPrice: "",
  notes: "",
  variants: [],
};

function ProductStatus({ status }: { status: Product["status"] }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
        status === "Active"
          ? "bg-emerald-50 text-emerald-700"
          : "bg-red-50 text-red-600"
      }`}
    >
      {status}
    </span>
  );
}

export default function Products() {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [error, setError] = useState("");

  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name
      .toLowerCase()
      .includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === "All" || product.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const currency = (value: number) =>
    `$${value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const openAddForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setShowForm(true);
  };

  const openEditForm = (product: Product) => {
    setEditingId(product.id);
    setForm({
      name: product.name,
      type: product.type,
      salesPrice: String(product.salesPrice),
      costPrice: String(product.costPrice),
      notes: product.notes,
      variants: product.variants.map((variant) => ({
        name: variant.name,
        priceAdjustment: String(variant.priceAdjustment),
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

  const updateField = (
    field: keyof Omit<ProductForm, "variants">,
    value: string
  ) => {
    setForm((previous) => ({ ...previous, [field]: value }));
  };

  const addVariant = () => {
    setForm((previous) => ({
      ...previous,
      variants: [
        ...previous.variants,
        { name: "", priceAdjustment: "0" },
      ],
    }));
  };

  const updateVariant = (
    index: number,
    field: keyof VariantForm,
    value: string
  ) => {
    setForm((previous) => ({
      ...previous,
      variants: previous.variants.map((variant, i) =>
        i === index ? { ...variant, [field]: value } : variant
      ),
    }));
  };

  const removeVariant = (index: number) => {
    setForm((previous) => ({
      ...previous,
      variants: previous.variants.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!form.name.trim()) {
      setError("Please enter a product name.");
      return;
    }

    const salesPrice = Number(form.salesPrice);
    const costPrice = Number(form.costPrice);

    if (
      !Number.isFinite(salesPrice) ||
      !Number.isFinite(costPrice) ||
      salesPrice < 0 ||
      costPrice < 0
    ) {
      setError("Prices must be valid non-negative numbers.");
      return;
    }

    const invalidVariant = form.variants.some(
      (variant) =>
        !variant.name.trim() ||
        variant.priceAdjustment.trim() === "" ||
        !Number.isFinite(Number(variant.priceAdjustment))
    );

    if (invalidVariant) {
      setError("Please enter a valid name and price adjustment for every variant.");
      return;
    }

    const savedProduct: Product = {
      id: editingId ?? Date.now(),
      name: form.name.trim(),
      type: form.type,
      salesPrice,
      costPrice,
      notes: form.notes.trim(),
      variants: form.variants.map((variant, index) => ({
        id: index + 1,
        name: variant.name.trim(),
        priceAdjustment: Number(variant.priceAdjustment),
      })),
      status:
        editingId !== null
          ? products.find((product) => product.id === editingId)!.status
          : "Active",
    };

    if (editingId !== null) {
      setProducts((previous) =>
        previous.map((product) =>
          product.id === editingId ? savedProduct : product
        )
      );
    } else {
      setProducts((previous) => [savedProduct, ...previous]);
    }

    closeForm();
  };

  const toggleArchive = (id: number) => {
    setProducts((previous) =>
      previous.map((product) =>
        product.id === id
          ? {
              ...product,
              status:
                product.status === "Active" ? "Archived" : "Active",
            }
          : product
      )
    );
  };

  const deleteProduct = (id: number) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this product from the demo list?"
    );

    if (confirmed) {
      setProducts((previous) =>
        previous.filter((product) => product.id !== id)
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Products
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage your products and variants.
          </p>
        </div>

        <button
          onClick={openAddForm}
          className="flex items-center justify-center gap-2 self-start rounded-lg bg-yellow-400 px-4 py-2.5 text-xs font-bold text-slate-900 shadow-sm transition hover:bg-yellow-500"
        >
          <Plus size={16} />
          Add Product
        </button>
      </div>

      {/* Product list */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search products..."
              className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-xs outline-none transition focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter size={15} className="text-slate-400" />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600 outline-none focus:border-yellow-400"
            >
              <option value="All">All statuses</option>
              <option value="Active">Active</option>
              <option value="Archived">Archived</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[750px] text-left">
            <thead className="bg-slate-50">
              <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <th className="px-5 py-4">Product Name</th>
                <th className="px-4 py-4">Type</th>
                <th className="px-4 py-4">Base Price</th>
                <th className="px-4 py-4">Cost Price</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-4 py-4">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filteredProducts.map((product) => (
                <tr
                  key={product.id}
                  className="text-xs transition hover:bg-slate-50/70"
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                        <Package size={17} />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">
                          {product.name}
                        </p>
                        <p className="mt-1 text-[10px] text-slate-400">
                          {product.variants.length} variants
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-4 text-slate-500">
                    {product.type}
                  </td>

                  <td className="px-4 py-4 font-semibold text-slate-700">
                    {currency(product.salesPrice)}
                  </td>

                  <td className="px-4 py-4 text-slate-500">
                    {currency(product.costPrice)}
                  </td>

                  <td className="px-4 py-4">
                    <ProductStatus status={product.status} />
                  </td>

                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditForm(product)}
                        title="Edit product"
                        className="rounded-md p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                      >
                        <Pencil size={15} />
                      </button>

                      <button
                        onClick={() => toggleArchive(product.id)}
                        title={
                          product.status === "Active"
                            ? "Archive product"
                            : "Activate product"
                        }
                        className="rounded-md p-2 text-slate-400 hover:bg-amber-50 hover:text-amber-600"
                      >
                        <Archive size={15} />
                      </button>

                      <button
                        onClick={() => deleteProduct(product.id)}
                        title="Delete demo product"
                        className="rounded-md p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center">
                    <Package
                      size={30}
                      className="mx-auto mb-3 text-slate-300"
                    />
                    <p className="text-sm font-semibold text-slate-600">
                      No products found
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

        <div className="border-t border-slate-100 px-5 py-3 text-[11px] text-slate-400">
          Showing {filteredProducts.length} of {products.length} products
        </div>
      </section>

      {/* Add/Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-3 sm:p-6">
          <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingId !== null ? "Edit Product" : "Add Product"}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {editingId !== null
                    ? "Update your product information."
                    : "Create a new product for your catalog."}
                </p>
              </div>

              <button
                onClick={closeForm}
                aria-label="Close product form"
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-5 overflow-y-auto p-6"
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-semibold text-slate-700">
                    Product Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    value={form.name}
                    onChange={(event) =>
                      updateField("name", event.target.value)
                    }
                    placeholder="e.g. BrightCRM"
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold text-slate-700">
                    Product Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.type}
                    onChange={(event) =>
                      updateField("type", event.target.value)
                    }
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-yellow-400"
                  >
                    <option>Software</option>
                    <option>Add-on</option>
                    <option>Service</option>
                    <option>Hardware</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold text-slate-700">
                    Sales Price <span className="text-red-500">*</span>
                  </label>
                  <div className="flex h-10 items-center rounded-lg border border-slate-200 focus-within:border-yellow-400">
                    <span className="px-3 text-xs text-slate-400">$</span>
                    <input
                      required
                      min="0"
                      step="0.01"
                      type="number"
                      value={form.salesPrice}
                      onChange={(event) =>
                        updateField("salesPrice", event.target.value)
                      }
                      placeholder="99.00"
                      className="h-full min-w-0 flex-1 rounded-r-lg pr-3 text-xs outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold text-slate-700">
                    Cost Price <span className="text-red-500">*</span>
                  </label>
                  <div className="flex h-10 items-center rounded-lg border border-slate-200 focus-within:border-yellow-400">
                    <span className="px-3 text-xs text-slate-400">$</span>
                    <input
                      required
                      min="0"
                      step="0.01"
                      type="number"
                      value={form.costPrice}
                      onChange={(event) =>
                        updateField("costPrice", event.target.value)
                      }
                      placeholder="40.00"
                      className="h-full min-w-0 flex-1 rounded-r-lg pr-3 text-xs outline-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold text-slate-700">
                  Notes
                </label>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(event) =>
                    updateField("notes", event.target.value)
                  }
                  placeholder="Enter product description..."
                  className="w-full resize-none rounded-lg border border-slate-200 p-3 text-xs outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100"
                />
              </div>

              {/* Variants */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">
                      Variants
                    </h3>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Optional product variations and price adjustments.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={addVariant}
                    className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    <Plus size={14} />
                    Add Variant
                  </button>
                </div>

                {form.variants.length > 0 && (
                  <div className="space-y-3">
                    {form.variants.map((variant, index) => (
                      <div
                        key={index}
                        className="grid grid-cols-1 items-end gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-[1fr_1fr_auto]"
                      >
                        <div>
                          <label className="mb-1.5 block text-[11px] font-medium text-slate-600">
                            Variant Name
                          </label>
                          <input
                            value={variant.name}
                            onChange={(event) =>
                              updateVariant(index, "name", event.target.value)
                            }
                            placeholder="e.g. Odoo"
                            className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-xs outline-none focus:border-yellow-400"
                          />
                        </div>

                        <div>
                          <label className="mb-1.5 block text-[11px] font-medium text-slate-600">
                            Price Adjustment ($)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={variant.priceAdjustment}
                            onChange={(event) =>
                              updateVariant(
                                index,
                                "priceAdjustment",
                                event.target.value
                              )
                            }
                            placeholder="560.00"
                            className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-xs outline-none focus:border-yellow-400"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => removeVariant(index)}
                          aria-label="Remove variant"
                          className="rounded-md p-2 text-red-500 hover:bg-red-50"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

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
                  className="rounded-lg bg-yellow-400 px-5 py-2.5 text-xs font-bold text-slate-900 shadow-sm hover:bg-yellow-500"
                >
                  {editingId !== null ? "Save Changes" : "Save Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
