import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db } from "../firebase";

const productTypes = [
  "Men Clothing",
  "Women Clothing",
  "Kids Clothing",
  "Footwear"
];

const brands = [
  "Nike",
  "Adidas",
  "Zara",
  "H&M",
  "Levi’s"
];


const Products = () => {
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [newProduct, setNewProduct] = useState({
    name: "",
    description: "",
    price: 0,
    brand: "",
    stock: 0,
    type: "",
    image: "",
    image2: "",
    image3: "",
  });
  const [editingProduct, setEditingProduct] = useState(null);

  const fetchProducts = async () => {
    const productsCol = collection(db, "products");
    const productSnapshot = await getDocs(productsCol);
    const productList = productSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    console.log("Fetched products:", productList); 
    setProducts(productList);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleAddProduct = async () => {
    await addDoc(collection(db, "products"), newProduct);
    setNewProduct({
      name: "",
      description: "",
      price: 0,
      brand: "",
      stock: 0,
      type: "",
      image: "",
      image2: "",
      image3: "",
    });
    fetchProducts(); 
  };

  const handleUpdateProduct = async (id) => {
    const productRef = doc(db, "products", id);
    await updateDoc(productRef, editingProduct);
    setEditingProduct(null); 
    fetchProducts(); 
  };

  const handleDeleteProduct = async (id) => {
    await deleteDoc(doc(db, "products", id));
    fetchProducts(); 
  };

  
  const filteredProducts = searchTerm
    ? products.filter((product) =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : products;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Manage Products</h1>

      {/* Search Bar */}
      <input
        type="text"
        className="border p-2 rounded mb-4 w-full"
        placeholder="Search products..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      {/* Form to add or edit product */}
      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">
          {editingProduct ? "Edit Product" : "Add New Product"}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            className="border p-2 rounded"
            placeholder="Name"
            value={editingProduct ? editingProduct.name : newProduct.name}
            onChange={(e) =>
              editingProduct
                ? setEditingProduct({ ...editingProduct, name: e.target.value })
                : setNewProduct({ ...newProduct, name: e.target.value })
            }
          />
          <input
            className="border p-2 rounded"
            placeholder="Description"
            value={
              editingProduct
                ? editingProduct.description
                : newProduct.description
            }
            onChange={(e) =>
              editingProduct
                ? setEditingProduct({
                    ...editingProduct,
                    description: e.target.value,
                  })
                : setNewProduct({ ...newProduct, description: e.target.value })
            }
          />
          <input
            type="number"
            className="border p-2 rounded"
            placeholder="Price (₹)"
            value={editingProduct ? editingProduct.price : newProduct.price}
            onChange={(e) =>
              editingProduct
                ? setEditingProduct({
                    ...editingProduct,
                    price: Number(e.target.value),
                  })
                : setNewProduct({
                    ...newProduct,
                    price: Number(e.target.value),
                  })
            }
          />
          <select
            className="border p-2 rounded"
            value={editingProduct ? editingProduct.brand : newProduct.brand}
            onChange={(e) =>
              editingProduct
                ? setEditingProduct({
                    ...editingProduct,
                    brand: e.target.value,
                  })
                : setNewProduct({ ...newProduct, brand: e.target.value })
            }
          >
            <option value="">Select Brand</option>
            {brands.map((brand) => (
              <option key={brand} value={brand}>
                {brand}
              </option>
            ))}
          </select>
          <input
            type="number"
            className="border p-2 rounded"
            placeholder="Stock"
            value={editingProduct ? editingProduct.stock : newProduct.stock}
            onChange={(e) =>
              editingProduct
                ? setEditingProduct({
                    ...editingProduct,
                    stock: Number(e.target.value),
                  })
                : setNewProduct({
                    ...newProduct,
                    stock: Number(e.target.value),
                  })
            }
          />
          <select
            className="border p-2 rounded"
            value={editingProduct ? editingProduct.type : newProduct.type}
            onChange={(e) =>
              editingProduct
                ? setEditingProduct({ ...editingProduct, type: e.target.value })
                : setNewProduct({ ...newProduct, type: e.target.value })
            }
          >
            <option value="">Select Type</option>
            {productTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <input
            className="border p-2 rounded"
            placeholder="Image URL"
            value={editingProduct ? editingProduct.image : newProduct.image}
            onChange={(e) =>
              editingProduct
                ? setEditingProduct({
                    ...editingProduct,
                    image: e.target.value,
                  })
                : setNewProduct({ ...newProduct, image: e.target.value })
            }
          />
          <input
            className="border p-2 rounded"
            placeholder="Secondary Image URL"
            value={editingProduct ? editingProduct.image2 : newProduct.image2}
            onChange={(e) =>
              editingProduct
                ? setEditingProduct({
                    ...editingProduct,
                    image2: e.target.value,
                  })
                : setNewProduct({ ...newProduct, image2: e.target.value })
            }
          />
          <input
            className="border p-2 rounded"
            placeholder="Tertiary Image URL"
            value={editingProduct ? editingProduct.image3 : newProduct.image3}
            onChange={(e) =>
              editingProduct
                ? setEditingProduct({
                    ...editingProduct,
                    image3: e.target.value,
                  })
                : setNewProduct({ ...newProduct, image3: e.target.value })
            }
          />
        </div>
        <button
          className="bg-green-500 text-white p-2 mt-4 rounded"
          onClick={
            editingProduct
              ? () => handleUpdateProduct(editingProduct.id)
              : handleAddProduct
          }
        >
          {editingProduct ? "Update Product" : "Add Product"}
        </button>
      </div>
      {/* Products Table */}
      <table className="min-w-full bg-white border border-gray-200 rounded-lg">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-4 py-2">Image</th>
            <th className="border px-4 py-2">Name</th>
            <th className="border px-4 py-2">Description</th>
            <th className="border px-4 py-2">Price (₹)</th>
            <th className="border px-4 py-2">Brand</th>
            <th className="border px-4 py-2">Stock</th>
            <th className="border px-4 py-2">Type</th>
            <th className="border px-4 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredProducts.map((product) => (
            <tr key={product.id} className="hover:bg-gray-50">
              <td className="border px-4 py-2">
                <img
                  src={product.image}
                  alt={product.name}
                  className="w-16 h-16 object-cover rounded"
                />
              </td>
              <td className="border px-4 py-2">{product.name}</td>
              <td className="border px-4 py-2">{product.description}</td>
              <td className="border px-4 py-2">
                ₹
                {product.price.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                })}
              </td>
              <td className="border px-4 py-2">{product.brand}</td>
              <td className="border px-4 py-2">{product.stock}</td>
              <td className="border px-4 py-2">{product.type}</td>
              <td className="border px-4 py-2">
                <button
                  className="bg-blue-500 text-white p-1 mr-2 rounded"
                  onClick={() => setEditingProduct(product)}
                >
                  Edit
                </button>
                <button
                  className="bg-red-500 text-white p-1 rounded"
                  onClick={() => handleDeleteProduct(product.id)}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Products;
