package StacksAndQueues;

/* A queue built from two stacks*/
public class QueueStack<T> {
    Stack<T> newest;
    Stack<T> oldest;

    public QueueStack() {
        newest = new Stack<T>();
        oldest = new Stack<T>();
    }

    public void enqueue(T toAdd) {
        newest.push(toAdd);
    }

    private void shift() {
        if (oldest.isEmpty()) {
            while (!newest.isEmpty()) {
                oldest.push(newest.pop());
            }
        }
    }

    public T peek() {
        shift();
        return oldest.peek();
    }

    public T dequeue() {
        shift();
        return oldest.pop();
    }

    public static void main(String[] args) {
        QueueStack<Integer> test = new QueueStack<>();

        test.enqueue(1);
        test.enqueue(2);
        test.enqueue(3);
        System.out.println(test.dequeue());
        test.enqueue(4);
        System.out.println(test.dequeue());
        System.out.println(test.dequeue());
        System.out.println(test.dequeue());

    }

}
