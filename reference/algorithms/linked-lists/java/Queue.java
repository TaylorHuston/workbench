/*
Basic Queue using a Linked List 
Based on Section 1.3 of Algorithms, 4th Edition
*/

public class Queue {
    //LinkedList that holds the Queue
    private LinkedList<String> queueList;
    
    //Constructor
    public Queue() {
        queueList = new LinkedList();
    }
    
    //Adds item to front of queue
    private void enqueue(String toAdd) {
        queueList.addToFront(toAdd);
    } //End enqueue
    
    //Gets and removes item from end of queue
    private String dequeue() {
        return queueList.removeFromEnd();
    } //End dequeue
    
    //Test client for Queue
    public static void main(String[] args) {
        Queue myQueue = new Queue();
        
        myQueue.enqueue("Test");
        myQueue.enqueue("Test2");
        StdOut.println(myQueue.dequeue());  //Test
        StdOut.println(myQueue.dequeue());  //Test2
        myQueue.enqueue("Test3");
        StdOut.println(myQueue.dequeue());  //Test3
        
    }
}
