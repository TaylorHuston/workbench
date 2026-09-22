package StacksAndQueues;

import java.util.NoSuchElementException;

/*Various Queue functions, from Chapter 3*/
public class Queue<T> {
    private static class QueueNode<T> {
        private T data;
        private QueueNode<T> next;

        public QueueNode(T data) {
            this.data = data;
        }
    }

    private QueueNode<T> head;
    private QueueNode<T> tail;

    public void enqueue(T data) {
        QueueNode<T> t = new QueueNode<>(data);
        if (tail == null) {
            tail = t;
            head = t;
        } else {
            tail.next = t;
            tail = t;
        }
    }

    public T dequeue() {
        if (head == null) {
            throw new NoSuchElementException();
        }

        T toReturn = head.data;
        head = head.next;
        if (head == null) {
            tail = null;
        }

        return toReturn;
    }

    public T peek() {
        if (head == null) {
            throw new NoSuchElementException();
        }

        return head.data;
    }

    public boolean isEmpty() {
        return (head == null);
    }
}
