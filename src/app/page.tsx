"use client";

import React, { useState, useMemo } from "react";
import styles from "./page.module.css";

interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
  emoji: string;
  stock: number;
  barcode: string;
}

interface CartItem {
  product: Product;
  quantity: number;
}

interface Transaction {
  id: string;
  timestamp: number; // raw milliseconds for filtering
  date: string; // display string
  items: { name: string; qty: number; price: number }[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethod: string;
  cashPaid?: number;
  change?: number;
}

// Module-level stable timestamp to avoid impure Date.now() calls during render phase
const SESSION_START_TIME = typeof window !== "undefined" ? Date.now() : 1781325000000;

// Seed Initial Products with Barcodes
const INITIAL_PRODUCTS: Product[] = [
  { id: 1, name: "Caramel Macchiato", category: "Coffee", price: 42000, emoji: "☕", stock: 15, barcode: "8991001" },
  { id: 2, name: "Espresso Double", category: "Coffee", price: 28000, emoji: "🥃", stock: 24, barcode: "8991002" },
  { id: 3, name: "Iced Matcha Latte", category: "Tea", price: 38000, emoji: "🍵", stock: 3, barcode: "8991003" }, // Low Stock
  { id: 4, name: "Croissant Almond", category: "Pastry", price: 32000, emoji: "🥐", stock: 8, barcode: "8991004" },
  { id: 5, name: "Chocolate Fudge Cake", category: "Pastry", price: 45000, emoji: "🍰", stock: 2, barcode: "8991005" }, // Low Stock
  { id: 6, name: "Spaghetti Carbonara", category: "Main Course", price: 65000, emoji: "🍝", stock: 12, barcode: "8991006" },
  { id: 7, name: "Nasi Goreng Special", category: "Main Course", price: 55000, emoji: "🍛", stock: 20, barcode: "8991007" },
  { id: 8, name: "Peach Mint Tea", category: "Tea", price: 30000, emoji: "🍹", stock: 15, barcode: "8991008" },
  { id: 9, name: "Avocado Affogato", category: "Coffee", price: 46000, emoji: "🥑", stock: 1, barcode: "8991009" }, // Low Stock
  { id: 10, name: "Red Velvet Waffle", category: "Dessert", price: 36000, emoji: "🧇", stock: 7, barcode: "8991010" },
  { id: 11, name: "Strawberry Panna Cotta", category: "Dessert", price: 29000, emoji: "🍮", stock: 9, barcode: "8991011" },
  { id: 12, name: "Lemon Iced Tea", category: "Tea", price: 25000, emoji: "🍋", stock: 30, barcode: "8991012" },
];

// Seed Initial Transactions over days for filtering
const INITIAL_TRANSACTIONS = (): Transaction[] => {
  const baseTime = SESSION_START_TIME;
  const oneDay = 24 * 3600 * 1000;
  return [
    {
      id: "TX-10521",
      timestamp: baseTime,
      date: new Date(baseTime).toLocaleString("id-ID"),
      items: [
        { name: "Caramel Macchiato", qty: 2, price: 42000 },
        { name: "Croissant Almond", qty: 1, price: 32000 }
      ],
      subtotal: 116000,
      tax: 12760,
      discount: 10000, // Rp 10.000 nominal discount
      total: 118760,
      paymentMethod: "QRIS"
    },
    {
      id: "TX-10512",
      timestamp: baseTime - oneDay * 1.2,
      date: new Date(baseTime - oneDay * 1.2).toLocaleString("id-ID"),
      items: [
        { name: "Spaghetti Carbonara", qty: 1, price: 65000 },
        { name: "Lemon Iced Tea", qty: 2, price: 25000 }
      ],
      subtotal: 115000,
      tax: 12650,
      discount: 0,
      total: 127650,
      paymentMethod: "CASH",
      cashPaid: 150000,
      change: 22350
    },
    {
      id: "TX-10493",
      timestamp: baseTime - oneDay * 4,
      date: new Date(baseTime - oneDay * 4).toLocaleString("id-ID"),
      items: [
        { name: "Nasi Goreng Special", qty: 2, price: 55000 },
        { name: "Peach Mint Tea", qty: 2, price: 30000 }
      ],
      subtotal: 170000,
      tax: 18700,
      discount: 15000,
      total: 173700,
      paymentMethod: "CARD"
    },
    {
      id: "TX-10454",
      timestamp: baseTime - oneDay * 12,
      date: new Date(baseTime - oneDay * 12).toLocaleString("id-ID"),
      items: [
        { name: "Chocolate Fudge Cake", qty: 2, price: 45000 },
        { name: "Avocado Affogato", qty: 1, price: 46000 }
      ],
      subtotal: 136000,
      tax: 14960,
      discount: 0,
      total: 150960,
      paymentMethod: "QRIS"
    },
    {
      id: "TX-10405",
      timestamp: baseTime - oneDay * 24,
      date: new Date(baseTime - oneDay * 24).toLocaleString("id-ID"),
      items: [
        { name: "Iced Matcha Latte", qty: 3, price: 38000 },
        { name: "Strawberry Panna Cotta", qty: 1, price: 29000 }
      ],
      subtotal: 143000,
      tax: 15730,
      discount: 20000,
      total: 138730,
      paymentMethod: "CASH",
      cashPaid: 150000,
      change: 11270
    }
  ];
};

export default function Home() {
  // Authentication & Access Control (ADMIN vs KASIR)
  const [userRole, setUserRole] = useState<"ADMIN" | "KASIR">("ADMIN");

  // Core POS states
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  
  // Nominal Discount State (as per SRS F001)
  const [discountNominal, setDiscountNominal] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "QRIS" | "CARD">("CASH");
  const [cashInput, setCashInput] = useState<string>("");
  
  // Sidebar navigation state (restricted for Cashier)
  const [activeTab, setActiveTab] = useState<"POS" | "Transactions" | "Analytics" | "Inventory" | "Settings">("POS");
  const [transactions, setTransactions] = useState<Transaction[]>(INITIAL_TRANSACTIONS);
  
  // Simulated Barcode Scanner State (SRS F001)
  const [barcodeInput, setBarcodeInput] = useState("");

  // Low Stock Settings (SRS F002)
  const [lowStockThreshold, setLowStockThreshold] = useState<number>(5);

  // Analytics filter state (SRS F003)
  const [analyticsPeriod, setAnalyticsPeriod] = useState<"Harian" | "Mingguan" | "Bulanan">("Harian");

  // Inventory modal form states
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [prodName, setProdName] = useState("");
  const [prodCategory, setProdCategory] = useState("Coffee");
  const [prodPrice, setProdPrice] = useState<number>(0);
  const [prodStock, setProdStock] = useState<number>(0);
  const [prodBarcode, setProdBarcode] = useState("");
  const [prodEmoji, setProdEmoji] = useState("☕");

  // Receipt modal state
  const [recentTransaction, setRecentTransaction] = useState<Transaction | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  
  // Mobile cart drawer state
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Enforce access control permissions by deriving allowed tab during rendering phase
  const currentTab = useMemo(() => {
    if (userRole === "KASIR" && activeTab !== "POS") {
      return "POS";
    }
    return activeTab;
  }, [userRole, activeTab]);

  // Currency Formatter
  const formatIDR = (value: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(value);
  };

  // Get unique categories for grid filter
  const categories = useMemo(() => {
    const cats = new Set(products.map((p) => p.category));
    return ["All", ...Array.from(cats)];
  }, [products]);

  // List of low-stock products based on Admin configurable threshold (SRS F002)
  const lowStockItems = useMemo(() => {
    return products.filter((p) => p.stock <= lowStockThreshold);
  }, [products, lowStockThreshold]);

  // Filtered products on grid (search and category filters)
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesCategory = selectedCategory === "All" || product.category === selectedCategory;
      const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            product.barcode.includes(searchQuery);
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  // Calculations for current checkout cart
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  }, [cart]);

  // Enforce business rule F001
  const validatedDiscount = useMemo(() => {
    return Math.min(subtotal, Math.max(0, discountNominal));
  }, [subtotal, discountNominal]);

  // Tax (VAT 11%)
  const tax = useMemo(() => Math.round(subtotal * 0.11), [subtotal]);

  // Grand total calculation
  const grandTotal = useMemo(() => {
    return Math.max(0, subtotal + tax - validatedDiscount);
  }, [subtotal, tax, validatedDiscount]);

  // Cash change due calculation
  const changeDue = useMemo(() => {
    const cash = parseFloat(cashInput) || 0;
    return Math.max(0, cash - grandTotal);
  }, [cashInput, grandTotal]);

  // Pure derived transaction filtering for Analytics timeline (F003)
  const filteredTransactionsForAnalytics = useMemo(() => {
    return transactions.filter((tx) => {
      const ageMs = SESSION_START_TIME - tx.timestamp;
      if (analyticsPeriod === "Harian") {
        const txDate = new Date(tx.timestamp);
        const sessionDate = new Date(SESSION_START_TIME);
        return (
          txDate.getDate() === sessionDate.getDate() &&
          txDate.getMonth() === sessionDate.getMonth() &&
          txDate.getFullYear() === sessionDate.getFullYear()
        );
      } else if (analyticsPeriod === "Mingguan") {
        return ageMs <= 7 * 24 * 3600 * 1000;
      } else {
        return ageMs <= 30 * 24 * 3600 * 1000;
      }
    });
  }, [transactions, analyticsPeriod]);

  // Barcode input simulator (SRS F001)
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanBarcode = barcodeInput.trim();
    if (!cleanBarcode) return;

    const matchedProduct = products.find((p) => p.barcode === cleanBarcode);
    if (matchedProduct) {
      if (matchedProduct.stock > 0) {
        addToCart(matchedProduct);
      } else {
        alert(`Product ${matchedProduct.name} is out of stock!`);
      }
    } else {
      alert(`Barcode "${cleanBarcode}" not recognized!`);
    }
    setBarcodeInput(""); // clear input instantly
  };

  // Add Item to Cart
  const addToCart = (product: Product) => {
    if (product.stock <= 0) return;

    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          alert(`Limit reached: Only ${product.stock} items of ${product.name} are available in stock.`);
          return prevCart;
        }
        return prevCart.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prevCart, { product, quantity: 1 }];
    });
  };

  // Update Cart Quantity
  const updateQuantity = (productId: number, amount: number) => {
    setCart((prevCart) => {
      const item = prevCart.find((i) => i.product.id === productId);
      if (!item) return prevCart;

      const newQty = item.quantity + amount;
      if (newQty <= 0) {
        return prevCart.filter((i) => i.product.id !== productId);
      }

      const originalProduct = products.find((p) => p.id === productId);
      if (originalProduct && newQty > originalProduct.stock) {
        alert(`Cannot add: Only ${originalProduct.stock} items are available in stock.`);
        return prevCart;
      }

      return prevCart.map((i) =>
        i.product.id === productId ? { ...i, quantity: newQty } : i
      );
    });
  };

  // Remove Item from Cart
  const removeFromCart = (productId: number) => {
    setCart((prevCart) => prevCart.filter((item) => item.product.id !== productId));
  };

  // Clear Cart
  const clearCart = () => {
    setCart([]);
    setDiscountNominal(0);
    setCashInput("");
  };

  // Checkout submission
  const handleCheckout = () => {
    if (cart.length === 0) return;

    // Validation checks
    const cash = parseFloat(cashInput) || 0;
    if (paymentMethod === "CASH" && cash < grandTotal) {
      alert("Insufficient cash paid!");
      return;
    }

    // Deduct stock from products database
    setProducts((prevProducts) =>
      prevProducts.map((prod) => {
        const cartItem = cart.find((item) => item.product.id === prod.id);
        if (cartItem) {
          return { ...prod, stock: Math.max(0, prod.stock - cartItem.quantity) };
        }
        return prod;
      })
    );

    // Record transaction with timestamp
    const checkoutTime = Date.now();
    const tx: Transaction = {
      id: `TX-${checkoutTime.toString().slice(-5)}`,
      timestamp: checkoutTime,
      date: new Date(checkoutTime).toLocaleString("id-ID"),
      items: cart.map((item) => ({
        name: item.product.name,
        qty: item.quantity,
        price: item.product.price,
      })),
      subtotal,
      tax,
      discount: validatedDiscount,
      total: grandTotal,
      paymentMethod,
      cashPaid: paymentMethod === "CASH" ? cash : grandTotal,
      change: paymentMethod === "CASH" ? changeDue : 0,
    };

    setTransactions((prev) => [tx, ...prev]);
    setRecentTransaction(tx);
    setShowSuccessModal(true);
    clearCart();
    setIsCartOpen(false);
  };

  // Preset cash handler
  const addPresetCash = (amount: number) => {
    const current = parseFloat(cashInput) || 0;
    setCashInput((current + amount).toString());
  };

  // Inventory CRUD handlers (F002: Admin Only)
  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName.trim() || !prodBarcode.trim() || prodPrice <= 0 || prodStock < 0) {
      alert("Please fill in all details correctly. Price and Stock must be non-negative.");
      return;
    }

    // Uniqueness Checks (section 4.4 Data Validation Rules)
    const isBarcodeDuplicate = products.some(
      (p) => p.barcode.trim() === prodBarcode.trim() && (!editingProduct || p.id !== editingProduct.id)
    );
    const isNameDuplicate = products.some(
      (p) => p.name.toLowerCase().trim() === prodName.toLowerCase().trim() && (!editingProduct || p.id !== editingProduct.id)
    );

    if (isBarcodeDuplicate) {
      alert("Validation Error: Barcode is already registered to another product.");
      return;
    }
    if (isNameDuplicate) {
      alert("Validation Error: Product name is already registered.");
      return;
    }

    if (editingProduct) {
      // Edit Product
      setProducts((prev) =>
        prev.map((p) =>
          p.id === editingProduct.id
            ? {
                ...p,
                name: prodName,
                category: prodCategory,
                price: prodPrice,
                stock: prodStock,
                barcode: prodBarcode,
                emoji: prodEmoji,
              }
            : p
        )
      );
      // Update items inside active cart if they correspond to this product
      setCart((prevCart) =>
        prevCart.map((item) =>
          item.product.id === editingProduct.id
            ? {
                ...item,
                product: {
                  ...item.product,
                  name: prodName,
                  price: prodPrice,
                  stock: prodStock,
                  barcode: prodBarcode,
                  emoji: prodEmoji,
                },
                quantity: Math.min(item.quantity, prodStock), // bound to new stock
              }
            : item
        ).filter((item) => item.quantity > 0) // delete if new stock is 0
      );
    } else {
      // Add Product - ID generation is computed deterministically from existing IDs to keep component pure
      const nextId = products.length > 0 ? Math.max(...products.map((p) => p.id)) + 1 : 1;
      const newProd: Product = {
        id: nextId,
        name: prodName,
        category: prodCategory,
        price: prodPrice,
        stock: prodStock,
        barcode: prodBarcode,
        emoji: prodEmoji,
      };
      setProducts((prev) => [...prev, newProd]);
    }

    closeModal();
  };

  const handleDeleteProduct = (id: number) => {
    if (confirm("Are you sure you want to delete this product?")) {
      setProducts((prev) => prev.filter((p) => p.id !== id));
      setCart((prevCart) => prevCart.filter((item) => item.product.id !== id));
    }
  };

  const openAddModal = () => {
    setEditingProduct(null);
    setProdName("");
    setProdCategory("Coffee");
    setProdPrice(0);
    setProdStock(0);
    setProdBarcode("");
    setProdEmoji("☕");
    setIsProductModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setProdName(product.name);
    setProdCategory(product.category);
    setProdPrice(product.price);
    setProdStock(product.stock);
    setProdBarcode(product.barcode);
    setProdEmoji(product.emoji);
    setIsProductModalOpen(true);
  };

  const closeModal = () => {
    setIsProductModalOpen(false);
    setEditingProduct(null);
  };

  // Analytics totals
  const totalRevenue = useMemo(() => {
    return filteredTransactionsForAnalytics.reduce((sum, tx) => sum + tx.total, 0);
  }, [filteredTransactionsForAnalytics]);

  const totalSalesCount = useMemo(() => {
    return filteredTransactionsForAnalytics.length;
  }, [filteredTransactionsForAnalytics]);

  const averageBill = useMemo(() => {
    if (totalSalesCount === 0) return 0;
    return Math.round(totalRevenue / totalSalesCount);
  }, [totalRevenue, totalSalesCount]);

  return (
    <div className={styles.container}>
      {/* Sidebar Navigation */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarLogo}>
          <span>K</span>
        </div>

        <nav className={styles.sidebarMenu}>
          {/* POS/Checkout Button (All roles) */}
          <button
            className={`${styles.sidebarBtn} ${currentTab === "POS" ? styles.sidebarBtnActive : ""}`}
            onClick={() => setActiveTab("POS")}
            title="Point of Sale (Checkout)"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="9" rx="1" />
              <rect x="14" y="3" width="7" height="5" rx="1" />
              <rect x="14" y="12" width="7" height="9" rx="1" />
              <rect x="3" y="16" width="7" height="5" rx="1" />
            </svg>
          </button>

          {/* Admin Restricted Sidebar Items */}
          {userRole === "ADMIN" && (
            <>
              {/* Transactions History */}
              <button
                className={`${styles.sidebarBtn} ${currentTab === "Transactions" ? styles.sidebarBtnActive : ""}`}
                onClick={() => setActiveTab("Transactions")}
                title="Transactions History"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 8v4l3 3" />
                  <circle cx="12" cy="12" r="10" />
                </svg>
              </button>

              {/* Revenue Reports */}
              <button
                className={`${styles.sidebarBtn} ${currentTab === "Analytics" ? styles.sidebarBtnActive : ""}`}
                onClick={() => setActiveTab("Analytics")}
                title="Revenue Reports"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
              </button>

              {/* Inventory Management CRUD */}
              <button
                className={`${styles.sidebarBtn} ${currentTab === "Inventory" ? styles.sidebarBtnActive : ""}`}
                onClick={() => setActiveTab("Inventory")}
                title="Inventory Management"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  <line x1="12" y1="11" x2="12" y2="17" />
                  <line x1="9" y1="14" x2="15" y2="14" />
                </svg>
              </button>
            </>
          )}

          {/* System Settings (Admin only) */}
          {userRole === "ADMIN" && (
            <button
              className={`${styles.sidebarBtn} ${currentTab === "Settings" ? styles.sidebarBtnActive : ""}`}
              onClick={() => setActiveTab("Settings")}
              title="System Settings"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          )}
        </nav>

        {/* Access Control Role Switcher */}
        <div
          className={styles.sidebarProfile}
          onClick={() => setUserRole((prev) => (prev === "ADMIN" ? "KASIR" : "ADMIN"))}
          title={`Switch Role (Current: ${userRole})`}
          style={{ cursor: "pointer", position: "relative" }}
        >
          <span>{userRole === "ADMIN" ? "AD" : "KS"}</span>
          <span
            style={{
              position: "absolute",
              bottom: "-5px",
              right: "-5px",
              background: userRole === "ADMIN" ? "var(--primary)" : "var(--success)",
              borderRadius: "50%",
              width: "14px",
              height: "14px",
              border: "3px solid #0a101c",
            }}
          ></span>
        </div>
      </aside>

      {/* Main Panel Content Area */}
      <main className={styles.mainSection}>
        {/* Header bar */}
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <h1>KasirApps Pro</h1>
              <span className={`${styles.roleBadge} ${userRole === "ADMIN" ? styles.roleAdmin : styles.roleKasir}`}>
                {userRole} Mode
              </span>
            </div>
            <p style={{ color: "var(--text-muted)", marginTop: "4px" }}>
              Location: Central Jakarta | Date: {new Date(SESSION_START_TIME).toLocaleDateString("id-ID")}
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            {/* Barcode scanner simulator input */}
            <form onSubmit={handleBarcodeSubmit} className={styles.barcodeSimForm} title="Press Enter to simulate scanning a barcode">
              <input
                type="text"
                placeholder="Scan Barcode No. (e.g. 8991001)"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
              />
              <button type="submit">Scan</button>
            </form>

            {/* Standard keyword search */}
            <div className={styles.searchBar}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </header>

        {/* Tab 1: POS Screen */}
        {currentTab === "POS" && (
          <div className={styles.contentBody}>
            {/* Low stock alerts dashboard notification (F002: visible to Admin) */}
            {userRole === "ADMIN" && lowStockItems.length > 0 && (
              <div className={`${styles.inventoryAlerts} animate-fade-in`}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(239,68,68,0.15)", paddingBottom: "8px" }}>
                  <strong style={{ color: "#fca5a5", fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "8px" }}>
                    ⚠️ Low Stock Warning Alerts (Threshold: {lowStockThreshold} items)
                  </strong>
                  <span style={{ fontSize: "0.75rem", background: "rgba(239, 68, 68, 0.2)", padding: "2px 8px", borderRadius: "4px", color: "#fca5a5", fontWeight: "700" }}>
                    {lowStockItems.length} items
                  </span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginTop: "4px" }}>
                  {lowStockItems.map((item) => (
                    <div key={item.id} className={styles.inventoryAlertItem}>
                      <span>{item.emoji} {item.name}</span>
                      <strong style={{ textDecoration: "underline" }}>(Stock: {item.stock})</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Category Selector Filters */}
            <div className={styles.categoriesWrapper}>
              <div className={styles.categoriesList}>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    className={`${styles.categoryBtn} ${selectedCategory === cat ? styles.categoryBtnActive : ""}`}
                    onClick={() => setSelectedCategory(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <span className="badge badge-primary">
                {filteredProducts.length} Items Listed
              </span>
            </div>

            {/* Product Cards Grid */}
            {filteredProducts.length > 0 ? (
              <div className={`${styles.productsGrid} animate-slide-up`}>
                {filteredProducts.map((product) => {
                  const isLowStock = product.stock <= lowStockThreshold;
                  const isOutOfStock = product.stock <= 0;
                  return (
                    <div
                      key={product.id}
                      className={`${styles.productCard} ${isOutOfStock ? styles.disabledCard : ""}`}
                      onClick={() => !isOutOfStock && addToCart(product)}
                      style={{
                        borderColor: isOutOfStock 
                          ? "rgba(239, 68, 68, 0.2)" 
                          : isLowStock 
                          ? "rgba(245, 158, 11, 0.4)" 
                          : "var(--border-color)"
                      }}
                    >
                      <div className={styles.productImagePlaceholder}>
                        <span>{product.emoji}</span>
                        <span className={`${styles.productStock} ${isOutOfStock ? styles.productStockOut : ""}`}>
                          {isOutOfStock ? "STOK HABIS" : `Stock: ${product.stock}`}
                        </span>
                        {/* Barcode number tag */}
                        <span style={{ position: "absolute", bottom: "8px", right: "8px", fontSize: "0.65rem", background: "rgba(0,0,0,0.5)", padding: "1px 6px", borderRadius: "3px", color: "var(--text-secondary)" }}>
                          {product.barcode}
                        </span>
                      </div>
                      <div className={styles.productInfo}>
                        <h3>{product.name}</h3>
                        <div className={styles.productPriceRow}>
                          <span className={styles.productPrice}>{formatIDR(product.price)}</span>
                          <button 
                            className={styles.productAddBtn} 
                            disabled={isOutOfStock}
                            style={{ background: isLowStock ? "var(--warning)" : "var(--primary)" }}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={styles.emptyCart} style={{ height: "40vh" }}>
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="8" y1="12" x2="16" y2="12" />
                </svg>
                <p>No products match current filters or search terms.</p>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Transactions History (Admin Only) */}
        {currentTab === "Transactions" && userRole === "ADMIN" && (
          <div className={styles.contentBody}>
            <h2>Transactions History</h2>
            <p style={{ color: "var(--text-muted)" }}>Laporan riwayat transaksi kasir yang tercatat secara real-time.</p>

            {transactions.length > 0 ? (
              <div className={`${styles.transactionsList} animate-slide-up`} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {transactions.map((tx) => (
                  <div key={tx.id} className="glass" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px" }}>
                      <div>
                        <strong style={{ color: "var(--secondary)", fontSize: "1.05rem" }}>{tx.id}</strong>
                        <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "4px" }}>{tx.date}</div>
                      </div>
                      <span className={`badge ${tx.paymentMethod === "CASH" ? "badge-success" : tx.paymentMethod === "QRIS" ? "badge-primary" : "badge-warning"}`}>
                        {tx.paymentMethod}
                      </span>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {tx.items.map((item, idx) => (
                        <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                          <span>
                            {item.name} <span style={{ color: "var(--text-muted)" }}>x{item.qty}</span>
                          </span>
                          <span>{formatIDR(item.price * item.qty)}</span>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "4px", borderTop: "1px dashed var(--border-color)", paddingTop: "12px", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Subtotal</span>
                        <span>{formatIDR(tx.subtotal)}</span>
                      </div>
                      {tx.discount > 0 && (
                        <div style={{ display: "flex", justifyContent: "space-between", color: "var(--accent)" }}>
                          <span>Discount</span>
                          <span>-{formatIDR(tx.discount)}</span>
                        </div>
                      )}
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Tax (11%)</span>
                        <span>{formatIDR(tx.tax)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "800", color: "var(--text-primary)", fontSize: "1.05rem", marginTop: "4px" }}>
                        <span>Grand Total</span>
                        <span style={{ color: "var(--secondary)" }}>{formatIDR(tx.total)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.emptyCart} style={{ height: "45vh" }}>
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                <p>No transaction history found.</p>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Revenue Analytics Reports (Admin Only) */}
        {currentTab === "Analytics" && userRole === "ADMIN" && (
          <div className={styles.contentBody}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2>Revenue Analytics & Income Reports</h2>
                <p style={{ color: "var(--text-muted)" }}>Real-time revenue metrics compiled dynamically from sales records.</p>
              </div>

              {/* Time Range Filter: Harian, Mingguan, Bulanan (SRS F003) */}
              <div className={styles.dateFilterGroup}>
                {(["Harian", "Mingguan", "Bulanan"] as const).map((period) => (
                  <button
                    key={period}
                    className={`${styles.dateFilterBtn} ${analyticsPeriod === period ? styles.dateFilterBtnActive : ""}`}
                    onClick={() => setAnalyticsPeriod(period)}
                  >
                    {period}
                  </button>
                ))}
              </div>
            </div>

            {/* Real-time stats widgets */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px", marginTop: "12px" }}>
              <div className="glass" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
                <span style={{ color: "var(--text-muted)", fontSize: "0.85rem", fontWeight: "600" }}>TOTAL SALES REVENUE ({analyticsPeriod.toUpperCase()})</span>
                <span style={{ fontSize: "1.75rem", fontWeight: "800", color: "var(--secondary)" }}>
                  {formatIDR(totalRevenue)}
                </span>
                <span style={{ fontSize: "0.75rem", color: "var(--success)" }}>Compiled from transaction timestamps</span>
              </div>
              <div className="glass" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
                <span style={{ color: "var(--text-muted)", fontSize: "0.85rem", fontWeight: "600" }}>COMPLETED BILLS</span>
                <span style={{ fontSize: "1.75rem", fontWeight: "800", color: "var(--text-primary)" }}>
                  {totalSalesCount}
                </span>
                <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Average: {averageBill > 0 ? formatIDR(averageBill) : "Rp 0"} / bill</span>
              </div>
              <div className="glass" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
                <span style={{ color: "var(--text-muted)", fontSize: "0.85rem", fontWeight: "600" }}>LOW STOCK INVENTORIES</span>
                <span style={{ fontSize: "1.75rem", fontWeight: "800", color: lowStockItems.length > 0 ? "var(--warning)" : "var(--success)" }}>
                  {lowStockItems.length}
                </span>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Threshold limit: &lt;= {lowStockThreshold} stock</span>
              </div>
            </div>

            {/* Sales Distribution Chart Bar (Dynamic representation) */}
            <div className="glass" style={{ padding: "24px", marginTop: "12px", display: "flex", flexDirection: "column", gap: "20px" }}>
              <h3>Sales Distribution Timeline ({analyticsPeriod})</h3>
              
              {filteredTransactionsForAnalytics.length > 0 ? (
                <div style={{ height: "240px", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "12px", padding: "10px 0", borderBottom: "1px solid var(--border-color)" }}>
                  {filteredTransactionsForAnalytics.slice(0, 8).map((tx, idx) => {
                    const percentage = Math.min(100, Math.max(10, Math.round((tx.total / Math.max(...filteredTransactionsForAnalytics.map(t => t.total))) * 90)));
                    return (
                      <div key={tx.id} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", height: "100%" }}>
                        <div style={{ flex: 1, width: "100%", position: "relative", display: "flex", alignItems: "flex-end" }}>
                          <div
                            className="animate-slide-up"
                            style={{
                              width: "100%",
                              height: `${percentage}%`,
                              background: idx % 2 === 0 ? "var(--primary)" : "var(--secondary)",
                              borderRadius: "6px 6px 0 0",
                              boxShadow: idx % 2 === 0 ? "0 0 15px rgba(79, 70, 229, 0.2)" : "0 0 15px rgba(6, 182, 212, 0.2)",
                              position: "relative"
                            }}
                          >
                            <div style={{ position: "absolute", top: "-22px", left: "50%", transform: "translateX(-50%)", fontSize: "0.7rem", fontWeight: "700", whiteSpace: "nowrap" }}>
                              {formatIDR(tx.total)}
                            </div>
                          </div>
                        </div>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{tx.id}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ height: "240px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
                  No transaction records to display on timeline chart.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 4: Inventory Management Panel (F002: Admin Only) */}
        {currentTab === "Inventory" && userRole === "ADMIN" && (
          <div className={styles.contentBody}>
            <div className={styles.inventoryHeader}>
              <div>
                <h2>Inventory & Stock Control</h2>
                <p style={{ color: "var(--text-muted)" }}>Add, edit, or delete items and adjust low stock alert thresholds.</p>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                {/* LOW STOCK THRESHOLD INPUT */}
                <div className={styles.thresholdControl}>
                  <label htmlFor="stock-threshold-input">Low Stock Threshold Alert:</label>
                  <input
                    id="stock-threshold-input"
                    type="number"
                    min="1"
                    max="100"
                    value={lowStockThreshold}
                    onChange={(e) => setLowStockThreshold(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                  <span>items</span>
                </div>

                <button className="btn btn-primary" onClick={openAddModal}>
                  + Add New Product
                </button>
              </div>
            </div>

            {/* CRUD Inventory Table */}
            <div className={styles.inventoryTableWrapper}>
              <table className={styles.inventoryTable}>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Barcode</th>
                    <th>Price</th>
                    <th>Stock</th>
                    <th style={{ textAlign: "center" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => {
                    const isLow = product.stock <= lowStockThreshold;
                    return (
                      <tr key={product.id}>
                        <td style={{ fontSize: "1.5rem", width: "60px" }}>{product.emoji}</td>
                        <td style={{ fontWeight: "600" }}>{product.name}</td>
                        <td>
                          <span className="badge badge-primary">{product.category}</span>
                        </td>
                        <td>
                          <code style={{ background: "rgba(255,255,255,0.05)", padding: "2px 6px", borderRadius: "4px" }}>
                            {product.barcode}
                          </code>
                        </td>
                        <td style={{ fontWeight: "700", color: "var(--secondary)" }}>{formatIDR(product.price)}</td>
                        <td>
                          <span
                            className="badge"
                            style={{
                              background: product.stock <= 0
                                ? "var(--danger-glow)"
                                : isLow
                                ? "var(--warning-glow)"
                                : "rgba(255,255,255,0.03)",
                              color: product.stock <= 0
                                ? "#fca5a5"
                                : isLow
                                ? "#fbbf24"
                                : "var(--text-primary)",
                              border: product.stock <= 0
                                ? "1px solid rgba(239, 68, 68, 0.2)"
                                : isLow
                                ? "1px solid rgba(245, 158, 11, 0.2)"
                                : "1px solid var(--border-color)"
                            }}
                          >
                            {product.stock <= 0 ? "Out of Stock" : `${product.stock} units`}
                          </span>
                        </td>
                        <td style={{ width: "160px" }}>
                          <div className={styles.actionBtnGroup}>
                            <button className={styles.editBtn} onClick={() => openEditModal(product)}>
                              Edit
                            </button>
                            <button className={styles.deleteBtn} onClick={() => handleDeleteProduct(product.id)}>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 5: Settings Screen (Admin Only) */}
        {currentTab === "Settings" && userRole === "ADMIN" && (
          <div className={styles.contentBody}>
            <h2>System Configurations</h2>
            <p style={{ color: "var(--text-muted)" }}>Configure cashier terminal and local receipts settings.</p>

            <div className="glass" style={{ padding: "28px", marginTop: "12px", display: "flex", flexDirection: "column", gap: "24px", maxWidth: "600px", textAlign: "left" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label style={{ fontSize: "0.85rem", fontWeight: "700" }}>Active Cashier Name</label>
                <input
                  type="text"
                  value="Jane Doe"
                  readOnly
                  style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--border-color)", padding: "12px", borderRadius: "8px", color: "var(--text-secondary)" }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label style={{ fontSize: "0.85rem", fontWeight: "700" }}>Active VAT / PB1 Tax Configuration</label>
                <input
                  type="text"
                  value="11% (Indonesian Standard)"
                  readOnly
                  style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--border-color)", padding: "12px", borderRadius: "8px", color: "var(--text-secondary)" }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label style={{ fontSize: "0.85rem", fontWeight: "700" }}>Printer Hardware Profile</label>
                <select style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)", padding: "12px", borderRadius: "8px", color: "white" }}>
                  <option>Network Thermal Printer (192.168.1.100)</option>
                  <option>USB Thermal Printer (COM4)</option>
                  <option>Bluetooth Pocket Printer (BT-POS58)</option>
                </select>
              </div>

              <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
                <button className="btn btn-primary" onClick={() => alert("Settings saved.")}>Save Changes</button>
                <button className="btn btn-secondary" onClick={() => setActiveTab("POS")}>Back to Dashboard</button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Right Invoice Checkout Drawer (POS tab only) */}
      <section className={`${styles.cartPanel} ${isCartOpen ? styles.cartPanelActive : ""} ${currentTab !== "POS" ? styles.hiddenCart : ""}`}>
        <div className={styles.cartHeader}>
          <h2>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="9" cy="21" r="1"/>
              <circle cx="20" cy="21" r="1"/>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
            </svg>
            Current Invoice
          </h2>
          {cart.length > 0 && (
            <button className={styles.clearCartBtn} onClick={clearCart}>
              Clear All
            </button>
          )}
        </div>

        {/* Cart items list */}
        <div className={styles.cartItems}>
          {cart.length > 0 ? (
            cart.map((item) => (
              <div key={item.product.id} className={styles.cartItem}>
                <div className={styles.cartItemLeft}>
                  <span className={styles.cartItemName}>{item.product.name}</span>
                  <span className={styles.cartItemPrice}>{formatIDR(item.product.price)}</span>
                </div>

                <div className={styles.cartQtyControls}>
                  <button className={styles.cartQtyBtn} onClick={() => updateQuantity(item.product.id, -1)}>-</button>
                  <span className={styles.cartQtyVal}>{item.quantity}</span>
                  <button className={styles.cartQtyBtn} onClick={() => updateQuantity(item.product.id, 1)}>+</button>
                </div>

                <button className={styles.cartItemRemove} onClick={() => removeFromCart(item.product.id)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            ))
          ) : (
            <div className={styles.emptyCart}>
              <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ stroke: "rgba(255, 255, 255, 0.03)" }}>
                <circle cx="9" cy="21" r="1"/>
                <circle cx="20" cy="21" r="1"/>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
              </svg>
              <p>Invoice cart is empty.<br/>Select products or scan barcodes to begin.</p>
            </div>
          )}
        </div>

        {/* Calculations & Payment summary block */}
        <div className={styles.cartSummary}>
          {/* Payment Method Selector */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", textAlign: "left" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase" }}>Payment Mode</span>
            <div className={styles.paymentMethods}>
              <button
                className={`${styles.payMethodBtn} ${paymentMethod === "CASH" ? styles.payMethodBtnActive : ""}`}
                onClick={() => setPaymentMethod("CASH")}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="2" y="6" width="20" height="12" rx="2" />
                  <circle cx="12" cy="12" r="2" />
                </svg>
                CASH
              </button>
              <button
                className={`${styles.payMethodBtn} ${paymentMethod === "QRIS" ? styles.payMethodBtnActive : ""}`}
                onClick={() => setPaymentMethod("QRIS")}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                </svg>
                QRIS
              </button>
              <button
                className={`${styles.payMethodBtn} ${paymentMethod === "CARD" ? styles.payMethodBtnActive : ""}`}
                onClick={() => setPaymentMethod("CARD")}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="2" y="5" width="20" height="14" rx="2" />
                  <line x1="2" y1="10" x2="22" y2="10" />
                </svg>
                CARD
              </button>
            </div>
          </div>

          <div className={styles.summaryDivider}></div>

          {/* Pricing calculations */}
          <div className={styles.summaryRow}>
            <span>Subtotal</span>
            <span>{formatIDR(subtotal)}</span>
          </div>

          {/* Nominal Discount Input (F001) */}
          <div className={styles.summaryRow}>
            <span>Promo Discount (Nominal)</span>
            <div className={styles.discountInputWrapper}>
              <input
                type="number"
                min="0"
                max={subtotal}
                placeholder="Rp discount"
                value={discountNominal || ""}
                onChange={(e) => setDiscountNominal(Math.max(0, parseInt(e.target.value) || 0))}
                style={{ width: "90px", textAlign: "right" }}
              />
              <span style={{ fontSize: "0.85rem", alignSelf: "center" }}>Rp</span>
            </div>
          </div>

          <div className={styles.summaryRow}>
            <span>Tax (VAT 11%)</span>
            <span>{formatIDR(tax)}</span>
          </div>

          <div className={styles.summaryRowTotal}>
            <span>Grand Total</span>
            <span>{formatIDR(grandTotal)}</span>
          </div>

          {/* Cash input area (only if Cash is selected) */}
          {paymentMethod === "CASH" && cart.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px", textAlign: "left" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: "700", color: "var(--text-muted)" }}>CASH RECEIVED (RP)</span>
                {changeDue > 0 && <span style={{ fontSize: "0.75rem", color: "var(--success)" }}>Change: {formatIDR(changeDue)}</span>}
              </div>
              <input
                type="number"
                placeholder="Enter cash amount..."
                value={cashInput}
                onChange={(e) => setCashInput(e.target.value)}
                style={{
                  background: "rgba(0, 0, 0, 0.4)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  color: "white",
                  fontSize: "1rem",
                  fontWeight: "bold",
                  textAlign: "right"
                }}
              />

              {/* Quick Cash Buttons */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px" }}>
                {[50000, 100000, 150000, 200000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => addPresetCash(amt)}
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "6px",
                      padding: "6px 0",
                      fontSize: "0.7rem",
                      color: "var(--text-secondary)",
                      cursor: "pointer"
                    }}
                  >
                    +{amt / 1000}k
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Checkout Button */}
          <button
            className="btn btn-primary"
            style={{ width: "100%", padding: "14px 0", fontSize: "1rem", marginTop: "6px" }}
            disabled={cart.length === 0 || (paymentMethod === "CASH" && (parseFloat(cashInput) || 0) < grandTotal)}
            onClick={handleCheckout}
          >
            CONFIRM CHECKOUT ({cart.reduce((sum, item) => sum + item.quantity, 0)} items)
          </button>
        </div>
      </section>

      {/* Floating Action Button for Cart in Mobile */}
      <button
        className={styles.mobileCartToggle}
        onClick={() => setIsCartOpen(!isCartOpen)}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="9" cy="21" r="1"/>
          <circle cx="20" cy="21" r="1"/>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
        </svg>
        {cart.length > 0 && (
          <span style={{
            position: "absolute",
            top: "-5px",
            right: "-5px",
            background: "var(--accent)",
            color: "white",
            borderRadius: "50%",
            width: "20px",
            height: "20px",
            fontSize: "0.7rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: "bold"
          }}>
            {cart.reduce((sum, item) => sum + item.quantity, 0)}
          </span>
        )}
      </button>

      {/* Product ADD/EDIT Modal (Inventory F002: Admin Only) */}
      {isProductModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent} style={{ maxWidth: "480px" }}>
            <h2>{editingProduct ? "Edit Product Details" : "Register New Product"}</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: "20px" }}>
              Provide stock numbers, category tags, barcode IDs, and details below.
            </p>

            <form onSubmit={handleSaveProduct}>
              <div className={styles.modalFormGroup}>
                <label htmlFor="prod-name-input">Product Name</label>
                <input
                  id="prod-name-input"
                  type="text"
                  placeholder="e.g. Americano Ice"
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div className={styles.modalFormGroup}>
                  <label htmlFor="prod-category-select">Category</label>
                  <select
                    id="prod-category-select"
                    value={prodCategory}
                    onChange={(e) => setProdCategory(e.target.value)}
                  >
                    <option value="Coffee">Coffee</option>
                    <option value="Tea">Tea</option>
                    <option value="Pastry">Pastry</option>
                    <option value="Main Course">Main Course</option>
                    <option value="Dessert">Dessert</option>
                  </select>
                </div>

                <div className={styles.modalFormGroup}>
                  <label htmlFor="prod-emoji-input">Emoji Icon</label>
                  <input
                    id="prod-emoji-input"
                    type="text"
                    placeholder="e.g. ☕"
                    value={prodEmoji}
                    onChange={(e) => setProdEmoji(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className={styles.modalFormGroup}>
                <label htmlFor="prod-barcode-input">Barcode Number ID (Must be unique)</label>
                <input
                  id="prod-barcode-input"
                  type="text"
                  placeholder="e.g. 8991015"
                  value={prodBarcode}
                  onChange={(e) => setProdBarcode(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div className={styles.modalFormGroup}>
                  <label htmlFor="prod-price-input">Unit Price (Rupiah)</label>
                  <input
                    id="prod-price-input"
                    type="number"
                    min="100"
                    placeholder="e.g. 25000"
                    value={prodPrice || ""}
                    onChange={(e) => setProdPrice(Math.max(0, parseInt(e.target.value) || 0))}
                    required
                  />
                </div>

                <div className={styles.modalFormGroup}>
                  <label htmlFor="prod-stock-input">Stock Level</label>
                  <input
                    id="prod-stock-input"
                    type="number"
                    min="0"
                    placeholder="e.g. 20"
                    value={prodStock ?? ""}
                    onChange={(e) => setProdStock(Math.max(0, parseInt(e.target.value) ?? 0))}
                    required
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Save Product
                </button>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={closeModal}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Checkout Receipt Thermal-Printer Styled Modal */}
      {showSuccessModal && recentTransaction && (
        <div className={styles.modalOverlay}>
          {/* Apply CSS id #thermal-receipt-print for media query print targeting */}
          <div className={styles.modalContent} id="thermal-receipt-print">
            <div className={`${styles.successIconWrapper} no-print`}>✓</div>
            <h2>TRANSAKSI BERHASIL</h2>
            <p className="no-print" style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginTop: "4px" }}>
              Struk belanja belanja siap dicetak.
            </p>

            <div className={styles.receiptDetails}>
              <div style={{ textAlign: "center", fontWeight: "bold", marginBottom: "8px", textTransform: "uppercase" }}>
                *** KASIR APPS CAFE ***<br/>
                JL. SILIWANGI NO. 45 JAKARTA
              </div>
              <div className={styles.receiptDivider}></div>
              <div className={styles.receiptRow}>
                <span>INVOICE NO:</span>
                <span>{recentTransaction.id}</span>
              </div>
              <div className={styles.receiptRow}>
                <span>WAKTU:</span>
                <span>{recentTransaction.date}</span>
              </div>
              <div className={styles.receiptRow}>
                <span>KASIR:</span>
                <span>Jane Doe</span>
              </div>

              <div className={styles.receiptDivider}></div>

              {recentTransaction.items.map((item, idx) => (
                <div key={idx} className={styles.receiptRow}>
                  <span>{item.name} x{item.qty}</span>
                  <span>{formatIDR(item.price * item.qty)}</span>
                </div>
              ))}

              <div className={styles.receiptDivider}></div>

              <div className={styles.receiptRow}>
                <span>Subtotal:</span>
                <span>{formatIDR(recentTransaction.subtotal)}</span>
              </div>
              {recentTransaction.discount > 0 && (
                <div className={styles.receiptRow} style={{ color: "var(--accent)" }}>
                  <span>Diskon Promo:</span>
                  <span>-{formatIDR(recentTransaction.discount)}</span>
                </div>
              )}
              <div className={styles.receiptRow}>
                <span>Pajak (11%):</span>
                <span>{formatIDR(recentTransaction.tax)}</span>
              </div>
              <div className={styles.receiptRow} style={{ fontWeight: "bold", fontSize: "0.9rem" }}>
                <span>TOTAL AKHIR:</span>
                <span>{formatIDR(recentTransaction.total)}</span>
              </div>

              <div className={styles.receiptDivider}></div>

              <div className={styles.receiptRow}>
                <span>METODE BAYAR:</span>
                <span>{recentTransaction.paymentMethod}</span>
              </div>
              <div className={styles.receiptRow}>
                <span>TUNAI DITERIMA:</span>
                <span>{formatIDR(recentTransaction.cashPaid || 0)}</span>
              </div>
              <div className={styles.receiptRow}>
                <span>KEMBALIAN:</span>
                <span>{formatIDR(recentTransaction.change || 0)}</span>
              </div>
              <div className={styles.receiptDivider}></div>
              <div style={{ textAlign: "center", marginTop: "8px", fontSize: "0.75rem" }}>
                TERIMA KASIH ATAS KUNJUNGAN ANDA<br/>
                BARANG YANG SUDAH DIBELI<br/>
                TIDAK DAPAT DITUKAR KEMBALI
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px", marginTop: "24px" }} className="no-print">
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={() => {
                  window.print();
                }}
              >
                Print Thermal Struk
              </button>
              <button
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() => setShowSuccessModal(false)}
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
