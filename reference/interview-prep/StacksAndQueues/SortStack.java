package StacksAndQueues;

/*Create a stack where the smallest item is always on top*/
public class SortStack {

    public static Stack<Integer> sort(Stack<Integer> toSort) {
        Stack<Integer> tempStack = new Stack<Integer>();
        while (!toSort.isEmpty()) {
            int temp = toSort.pop();
            while (!tempStack.isEmpty() && tempStack.peek() < temp) {
                toSort.push(tempStack.pop());
            }
            tempStack.push(temp);
        }
        return tempStack;
    }

    public static void main(String[] args) {
        Stack temp = new Stack();

        temp.push(1);
        temp.push(2);
        temp.push(3);
        temp.push(6);
        temp.push(4);
        temp.push(5);


        temp = SortStack.sort(temp);
    }

}
