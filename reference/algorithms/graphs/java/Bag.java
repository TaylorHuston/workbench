/**
 * Bag ADT implementation
 * Based on Algorithms, 4th Ed by Robert Sedgewick | Kevin Wayne
 */

import java.util.Iterator;

public class Bag<T> implements Iterable<T> {
    private Node first; //Start of bag

    private class Node {
        T item;
        Node next;
    }

    public void add(T item) {
        Node temp = first;
        first = new Node();
        first.next = temp;
        first.item = item;
    }

    public Iterator<T> iterator() {
        return new ListIterator();
    }

    private class ListIterator implements Iterator<T> {
        private Node current = first;

        public boolean hasNext() {
            return current != null;
        }

        public T next() {
            T item = current.item;
            current = current.next;
            return item;
        }
    }
}
