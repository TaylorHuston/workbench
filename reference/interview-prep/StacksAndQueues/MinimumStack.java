package StacksAndQueues;

/*Stack with an additional min() method that returns the minimum value in O(1)*/
public class MinimumStack extends Stack {
    Stack<Integer> minStack;

    public void push(Integer data) {
        super.push(data);
        if (minStack == null) {
            minStack = new Stack();
            minStack.push(data);
        } else if (data < minStack.peek()) {
            minStack.push(data);
        }
    }

    public Integer pop() {
        Integer toReturn = (Integer) super.pop();
        if (toReturn == minStack.peek()) {
            minStack.pop();
        }
        return toReturn;
    }

    public static void main(String[] args) {
        MinimumStack testStack = new MinimumStack();
        testStack.push(3);
        testStack.push(2);
        testStack.push(4);
        testStack.push(1);
        testStack.pop();
        testStack.pop();

    }
}
