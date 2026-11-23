import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Trash2, Sparkles, Sliders } from "react-feather";
import { Card, Button, Input } from "./ui";
import { getCategoryOptionPresets, normalizeOptions } from "../utils/productOptions";

/**
 * Category-aware product options editor.
 *
 * Used by both Add Product and Edit Product so the storefront and admin always
 * agree on the `product.options` shape:
 *   [{ name, values: [], required }]
 */
const ProductOptionsEditor = ({ options = [], onChange, category = "" }) => {
  const [newValues, setNewValues] = useState({});
  const [newGroupName, setNewGroupName] = useState("");

  const safeOptions = useMemo(() => (Array.isArray(options) ? options : []), [options]);
  const suggestions = useMemo(() => getCategoryOptionPresets(category), [category]);

  const updateGroup = (index, patch) => {
    const next = safeOptions.map((group, i) => (i === index ? { ...group, ...patch } : group));
    onChange(next);
  };

  const addGroup = (preset = null) => {
    const name = (preset?.name || newGroupName || "").trim();
    if (!name) return;
    const exists = safeOptions.some((group) => group.name.toLowerCase() === name.toLowerCase());
    if (exists) return;
    onChange([
      ...safeOptions,
      {
        name,
        values: Array.isArray(preset?.values) ? [...preset.values] : [],
        required: preset?.required !== false,
      },
    ]);
    if (!preset) setNewGroupName("");
  };

  const removeGroup = (index) => {
    onChange(safeOptions.filter((_, i) => i !== index));
    setNewValues((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  const addValue = (index) => {
    const raw = (newValues[index] || "").trim();
    if (!raw) return;
    const group = safeOptions[index];
    if (!group) return;
    const values = Array.isArray(group.values) ? group.values : [];
    if (values.some((value) => value.toLowerCase() === raw.toLowerCase())) {
      setNewValues((prev) => ({ ...prev, [index]: "" }));
      return;
    }
    updateGroup(index, { values: [...values, raw] });
    setNewValues((prev) => ({ ...prev, [index]: "" }));
  };

  const removeValue = (index, value) => {
    const group = safeOptions[index];
    if (!group) return;
    updateGroup(index, { values: (group.values || []).filter((entry) => entry !== value) });
  };

  const applySuggestion = (preset) => {
    const existingIndex = safeOptions.findIndex(
      (group) => group.name.toLowerCase() === preset.name.toLowerCase()
    );
    if (existingIndex >= 0) {
      updateGroup(existingIndex, {
        values: preset.values,
        required: preset.required !== false,
      });
    } else {
      addGroup(preset);
    }
  };

  const applyAllSuggestions = () => {
    const next = [...safeOptions];
    suggestions.forEach((preset) => {
      const existingIndex = next.findIndex(
        (group) => group.name.toLowerCase() === preset.name.toLowerCase()
      );
      if (existingIndex >= 0) {
        next[existingIndex] = { ...next[existingIndex], values: [...preset.values] };
      } else {
        next.push({ ...preset, values: [...preset.values] });
      }
    });
    onChange(normalizeOptions(next));
  };

  return (
    <Card title="Product Options" icon={<Sliders className="w-5 h-5 text-violet-600" />}>
      <div className="space-y-5">
        <p className="text-sm text-slate-500">
          Sell every variation from one listing. Customers pick these options on the product page,
          and the exact choice is carried through the cart, invoice PDF and order emails.
        </p>

        {category && suggestions.length > 0 && (
          <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-violet-900">
                <Sparkles className="w-4 h-4" />
                Suggested for “{category}”
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={applyAllSuggestions}
                className="!py-1.5 !px-3 text-xs border-violet-200 text-violet-700 hover:bg-white"
              >
                Apply all
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {suggestions.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => applySuggestion(preset)}
                  className="group inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-white px-3 py-1.5 text-xs font-semibold text-violet-700 transition-all hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-sm"
                >
                  <Plus className="w-3 h-3" />
                  {preset.name}
                  <span className="max-w-[10rem] truncate text-violet-400 font-medium">
                    {preset.values.slice(0, 3).join(' / ')}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {safeOptions.map((group, index) => (
            <motion.div
              key={index}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <Input
                    label={`Option ${index + 1}`}
                    placeholder="e.g. Frame Size"
                    value={group.name}
                    onChange={(event) => updateGroup(index, { name: event.target.value })}
                    className="mb-0"
                  />
                </div>
                <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 sm:mt-5">
                  <input
                    type="checkbox"
                    checked={group.required !== false}
                    onChange={(event) => updateGroup(index, { required: event.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                  />
                  Required
                </label>
                <button
                  type="button"
                  onClick={() => removeGroup(index)}
                  className="mt-1 self-start rounded-lg p-2 text-red-500 transition-colors hover:bg-red-50 hover:text-red-700 sm:mt-5"
                  aria-label={`Remove ${group.name || 'option'}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <AnimatePresence initial={false}>
                  {(group.values || []).map((value) => (
                    <motion.span
                      key={value}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700"
                    >
                      {value}
                      <button
                        type="button"
                        onClick={() => removeValue(index, value)}
                        className="rounded-full p-0.5 text-gray-400 transition-colors hover:bg-white hover:text-red-500"
                        aria-label={`Remove ${value}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </motion.span>
                  ))}
                </AnimatePresence>
              </div>

              <div className="mt-3 flex gap-2">
                <Input
                  placeholder={`Add value${group.name ? ` for ${group.name}` : ''}`}
                  value={newValues[index] || ""}
                  onChange={(event) =>
                    setNewValues((prev) => ({ ...prev, [index]: event.target.value }))
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addValue(index);
                    }
                  }}
                  className="mb-0 flex-1"
                />
                <Button
                  type="button"
                  onClick={() => addValue(index)}
                  icon={<Plus className="w-4 h-4" />}
                  className="shrink-0"
                >
                  Add
                </Button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        <div className="flex flex-col gap-2 rounded-xl border border-dashed border-gray-300 bg-gray-50/50 p-4 sm:flex-row sm:items-center">
          <Input
            placeholder="New option group, e.g. Colour"
            value={newGroupName}
            onChange={(event) => setNewGroupName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addGroup();
              }
            }}
            className="mb-0 flex-1"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => addGroup()}
            disabled={!newGroupName.trim()}
            icon={<Plus className="w-4 h-4" />}
            className="shrink-0"
          >
            Add option group
          </Button>
        </div>

        {safeOptions.length === 0 && (
          <p className="text-xs text-gray-400">
            No options yet. This product will be sold as a single version.
          </p>
        )}
      </div>
    </Card>
  );
};

export default ProductOptionsEditor;
