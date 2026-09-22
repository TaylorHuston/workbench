import { useState } from "react";

// This example introduces derived UI. The product list is not stored in state;
// it is recalculated from the original products plus the current filter state.
// In React, prefer storing the smallest amount of state needed, then derive the
// visible UI during render.

function ProductCategoryRow({ category }) {
  return (
    <tr>
      <th colSpan="2">{category}</th>
    </tr>
  );
}

function ProductRow({ product }) {
  // JSX can be assigned to variables. Here, out-of-stock products get a visual
  // treatment without changing the product data itself.
  const name = product.stocked ? product.name : <span style={{ color: "#fca5a5" }}>{product.name}</span>;

  return (
    <tr>
      <td>{name}</td>
      <td>{product.price}</td>
    </tr>
  );
}

function ProductTable({ products, filterText, inStockOnly }) {
  // rows is derived during render. It does not need useState because it can be
  // recomputed from props every time filterText or inStockOnly changes.
  const rows = [];
  let lastCategory = null;

  products.forEach((product) => {
    const matchesSearch = product.name.toLowerCase().includes(filterText.toLowerCase());

    if (!matchesSearch) {
      return;
    }

    if (inStockOnly && !product.stocked) {
      return;
    }

    // Insert a category header whenever the category changes in the sorted list.
    if (product.category !== lastCategory) {
      rows.push(<ProductCategoryRow category={product.category} key={product.category} />);
    }

    rows.push(<ProductRow product={product} key={`${product.category}-${product.name}`} />);
    lastCategory = product.category;
  });

  return (
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Price</th>
        </tr>
      </thead>
      <tbody>{rows}</tbody>
    </table>
  );
}

function SearchBar({ filterText, inStockOnly, onFilterTextChange, onInStockOnlyChange }) {
  return (
    // The form groups related controls, but this example filters immediately on
    // change instead of submitting to a server.
    <form onSubmit={(event) => event.preventDefault()}>
      <input
        type="text"
        placeholder="Search..."
        value={filterText}
        // Controlled inputs get their value from React state and report changes
        // back through onChange. The parent owns the state.
        onChange={(event) => onFilterTextChange(event.target.value)}
      />
      <label>
        <input
          type="checkbox"
          checked={inStockOnly}
          onChange={(event) => onInStockOnlyChange(event.target.checked)}
        />
        Only show products in stock
      </label>
    </form>
  );
}

function FilterableProductTable({ products }) {
  // These are the two true pieces of state in this example. The filtered rows are
  // derived from these values and products, so they should not be stored separately.
  const [filterText, setFilterText] = useState("");
  const [inStockOnly, setInStockOnly] = useState(false);

  return (
    <div>
      <p>
        Type in the search box or toggle the checkbox. React stores only the form
        values, then derives the table rows during render.
      </p>

      <SearchBar
        filterText={filterText}
        inStockOnly={inStockOnly}
        onFilterTextChange={setFilterText}
        onInStockOnlyChange={setInStockOnly}
      />
      <ProductTable products={products} filterText={filterText} inStockOnly={inStockOnly} />
    </div>
  );
}

const PRODUCTS = [
  { category: "Fruits", price: "$1", stocked: true, name: "Apple" },
  { category: "Fruits", price: "$1", stocked: true, name: "Dragonfruit" },
  { category: "Fruits", price: "$2", stocked: false, name: "Passionfruit" },
  { category: "Vegetables", price: "$2", stocked: true, name: "Spinach" },
  { category: "Vegetables", price: "$4", stocked: false, name: "Pumpkin" },
  { category: "Vegetables", price: "$1", stocked: true, name: "Peas" },
];

export default function DerivedUI() {
  return <FilterableProductTable products={PRODUCTS} />;
}
