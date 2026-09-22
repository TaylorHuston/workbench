/*
 Linked List Implementation, 
Based on Section 1.3 of Algorithms, 4th Edition
 */

import java.util.Iterator;
import java.util.NoSuchElementException;

public class LinkedList<T> implements Iterable<T> {

    //Holds the name of the list, if applicable
    private String name;  
    private Node head;
    private Node tail;

    //Constructors
    public LinkedList() {
        this("N/A");
    }
    
    //Constructor with name
    public LinkedList(String name) {
        this.name = name;
        head = null;
        tail = head;
    }
    
    //The nodes for the list
    private class Node {
        //The generic data the nodes contain
        private T data;

        private Node next;
        private Node prev;
        
        //Constructor
        public Node(T newData) {
            data = newData;
            next = null;
            prev = null;
        }

        @Override
        //toString method
        public String toString() {
            return data.toString();
        }

        //Deletes a node
        private void deleteNode() {  
            if (this.prev != null) {
                this.prev.next = this.next;
            }
            if (this.next != null) {
                this.next.prev = this.prev;
            }
        }
    }

    //Checks if the list is empty
    private boolean isEmpty() {
        return head == null;
    }
    
    //Adds node to end of list
    public void addToEnd(T newData) {
        if (isEmpty()) {  
            head = new Node(newData);
            tail = head;
        } else {
            tail.next = new Node(newData);
            tail.next.prev = tail;
            tail = tail.next;
        }
    }

    //Removes node from end of list
    public T removeFromEnd() {
        //Trying to remove when there's no nodes left
        if (isEmpty()) {
            throw new NoSuchElementException("List empty");
        }
        
        T toReturn = tail.data;

        if (tail == head) {
            tail = null;
            head = null;
        } else {
            tail = tail.prev;
            tail.next = null;
        }

        return toReturn;
    }

    //Adds node to beginning of list, for a queue
    public void addToFront(T newData) {
        if (isEmpty()) {  
            head = new Node(newData);
            tail = head;
        } else {
            head.prev = new Node(newData);
            head.prev.next = head;
            head = head.prev;
        }
    }

    //Removes node from end of list
    public T removeFromFront()  {
        if (isEmpty()) {
            throw new NoSuchElementException("List empty");
        }

        T toReturn = head.data;

        if (tail == head) {
            tail = null;
            head = null;
        } else {
            head = head.next;
            head.prev = null;
        }
        
        return toReturn;
    }

//    //Prints list from head to end
//    public void printList() {
//        Node current = head;
//        while (current != null) {
//            StdOut.print(current + " ");
//            current = current.next;
//        }
//    } //End printList

    //Iterable methods
    public Iterator<T> iterator() {
        return new ListIterator();
    }

    private class ListIterator implements Iterator<T> {

        private Node curr = head;

        public boolean hasNext() {
            return curr != null;
        }

        public T next() {
            if (!hasNext()) {
                throw new NoSuchElementException();
            }
            T data = curr.data;
            curr = curr.next;
            return data;
        }

        //Not implemented
        public void remove() {
            throw new UnsupportedOperationException();
        }

    } //End ListIterator
    

    //Test client
    public static void main(String[] args) {
        LinkedList<Integer> testLL = new LinkedList<Integer>("Test");

        testLL.addToFront(10);
        testLL.removeFromEnd();
        printLL(testLL);  //List empty

        testLL.addToEnd(3); 
        testLL.addToEnd(4); 
        testLL.addToFront(2); 
        testLL.addToEnd(5); 
        testLL.addToFront(1); 
        printLL(testLL); //1 2 3 4 5
        
        testLL.removeFromEnd();
        testLL.removeFromFront();
        testLL.addToFront(0);
        printLL(testLL); //0 2 3 4   
        
        try {
            testLL.removeFromEnd();
            testLL.removeFromEnd();
            testLL.removeFromEnd();
            testLL.removeFromEnd();
            testLL.removeFromEnd();
        } catch (NoSuchElementException e) {
            StdOut.println("Error when trying to remove from end: "
            + e.getMessage());
        }

    }
    
    static void printLL(LinkedList testLL) {
        if (testLL.isEmpty()) {
            StdOut.println("List empty");
            return;
        }

        Iterator testIterator = testLL.iterator();
        while (testIterator.hasNext()) {
            Object toPrint = testIterator.next();
            StdOut.print(toPrint.toString() + " ");
        }
        StdOut.println();
    }
}