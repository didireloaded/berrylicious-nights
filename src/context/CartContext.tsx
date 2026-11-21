import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import type { MenuItem } from "@/data/menu";

export interface SteakCustomization {
  weight?: string;
  doneness?: string;
  side?: string;
  sauces?: string[];
}

export interface CartItem extends MenuItem {
  quantity: number;
  baseItemId?: string;
  weight?: string;
  doneness?: string;
  side?: string;
  sauces?: string[];
}

interface CartState {
  items: CartItem[];
}

type CartAction =
  | { type: "ADD_ITEM"; payload: MenuItem & Partial<SteakCustomization> & { baseItemId?: string } }
  | { type: "REMOVE_ITEM"; payload: string }
  | { type: "UPDATE_QUANTITY"; payload: { id: string; quantity: number } }
  | { type: "CLEAR_CART" }
  | { type: "LOAD_CART"; payload: CartItem[] };

const CART_STORAGE_KEY = "berrylicious-cart";

function buildCartLineId(
  item: MenuItem,
  custom?: SteakCustomization,
): string {
  if (!custom) return item.id;
  const parts = [
    custom.weight ?? "",
    custom.doneness ?? "",
    custom.side ?? "",
    custom.sauces?.slice().sort().join(",") ?? "",
  ];
  if (parts.every((p) => p === "")) return item.id;
  return `${item.id}::${parts.join("|")}`;
}

function isValidCartItem(item: unknown): item is CartItem {
  if (!item || typeof item !== "object") return false;
  const candidate = item as Partial<CartItem>;
  return (
    typeof candidate.id === "string" &&
    candidate.id.length > 0 &&
    typeof candidate.name === "string" &&
    typeof candidate.price === "number" &&
    Number.isFinite(candidate.price) &&
    typeof candidate.quantity === "number" &&
    Number.isFinite(candidate.quantity) &&
    candidate.quantity > 0
  );
}

function readInitialCartState(): CartState {
  if (typeof localStorage === "undefined") return { items: [] };
  try {
    const saved = localStorage.getItem(CART_STORAGE_KEY);
    if (!saved) return { items: [] };
    const parsed: unknown = JSON.parse(saved);
    if (!Array.isArray(parsed)) return { items: [] };
    return { items: parsed.filter(isValidCartItem) };
  } catch {
    return { items: [] };
  }
}

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD_ITEM": {
      const existingIndex = state.items.findIndex((i) => i.id === action.payload.id);
      if (existingIndex !== -1) {
        const next = state.items.slice();
        const current = next[existingIndex];
        next[existingIndex] = { ...current, quantity: current.quantity + 1 };
        return { items: next };
      }
      return { items: [...state.items, { ...action.payload, quantity: 1 }] };
    }
    case "REMOVE_ITEM": {
      const next = state.items.filter((i) => i.id !== action.payload);
      return next.length === state.items.length ? state : { items: next };
    }
    case "UPDATE_QUANTITY": {
      if (action.payload.quantity <= 0) {
        const next = state.items.filter((i) => i.id !== action.payload.id);
        return next.length === state.items.length ? state : { items: next };
      }
      let changed = false;
      const next = state.items.map((i) => {
        if (i.id !== action.payload.id || i.quantity === action.payload.quantity) return i;
        changed = true;
        return { ...i, quantity: action.payload.quantity };
      });
      return changed ? { items: next } : state;
    }
    case "CLEAR_CART":
      return state.items.length === 0 ? state : { items: [] };
    case "LOAD_CART":
      return { items: action.payload.filter(isValidCartItem) };
    default:
      return state;
  }
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: MenuItem, customization?: SteakCustomization & { priceOverride?: number }) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, undefined, readInitialCartState);

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state.items));
    } catch {
      // Ignore storage quota or private browsing errors
    }
  }, [state.items]);

  const addItem = useCallback(
    (item: MenuItem, customization?: SteakCustomization & { priceOverride?: number }) => {
      if (!customization) {
        dispatch({ type: "ADD_ITEM", payload: item });
        return;
      }
      const { priceOverride, ...mods } = customization;
      const lineId = buildCartLineId(item, mods);
      dispatch({
        type: "ADD_ITEM",
        payload: {
          ...item,
          id: lineId,
          baseItemId: item.id,
          price: typeof priceOverride === "number" && Number.isFinite(priceOverride) ? priceOverride : item.price,
          weight: mods.weight,
          doneness: mods.doneness,
          side: mods.side,
          sauces: mods.sauces && mods.sauces.length > 0 ? mods.sauces : undefined,
        },
      });
    },
    [],
  );

  const removeItem = useCallback((id: string) => {
    dispatch({ type: "REMOVE_ITEM", payload: id });
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    dispatch({ type: "UPDATE_QUANTITY", payload: { id, quantity } });
  }, []);

  const clearCart = useCallback(() => {
    dispatch({ type: "CLEAR_CART" });
  }, []);

  const { totalItems, totalPrice } = useMemo(() => {
    let count = 0;
    let price = 0;
    for (const item of state.items) {
      count += item.quantity;
      price += item.price * item.quantity;
    }
    return { totalItems: count, totalPrice: price };
  }, [state.items]);

  const value = useMemo<CartContextType>(
    () => ({
      items: state.items,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      totalItems,
      totalPrice,
    }),
    [state.items, addItem, removeItem, updateQuantity, clearCart, totalItems, totalPrice],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
