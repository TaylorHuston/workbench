// Lists in React are usually plain JavaScript arrays transformed with map().
// The important React-specific detail is the `key` prop, which gives each
// rendered item a stable identity between renders. It is not optional.

const products = [
  { id: "cabbage", title: "Cabbage", category: "Vegetable", isFruit: false },
  { id: "garlic", title: "Garlic", category: "Vegetable", isFruit: false },
  { id: "apple", title: "Apple", category: "Fruit", isFruit: true },
];

export default function Lists() {
  // map() returns a new array. Here that new array contains JSX elements.
  const listItems = products.map((product) => (
    <li
      // key is not a normal prop your component reads. React uses it internally
      // to match old and new list items when the list changes.
      key={product.id}
      style={{
        color: product.isFruit ? "#f9a8d4" : "#86efac",
      }}
    >
      <strong>{product.title}</strong> ({product.category})
    </li>
  ));

  return (
    <section>
      <p>
        Use stable data IDs for keys. Avoid array indexes as keys when items can
        be inserted, removed, sorted, or filtered.
      </p>

      <ul>{listItems}</ul>
    </section>
  );
}
