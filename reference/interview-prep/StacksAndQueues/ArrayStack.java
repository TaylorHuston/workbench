package StacksAndQueues;

/*Multiple stacks implemented in one array, from Chapter 3*/
public class ArrayStack<T> {

    private T[] theStack;
    private StackInfo[] stackInfo;
    private int numStacks;
    private int stackSize;

    //Holds the data of each individual stack
    private static class StackInfo {
        public int start;
        public int top;
        public int capacity;

        public StackInfo(int number, int capacity) {
            int start = number * capacity;
            this.start = start;
            this.top = start;
            this.capacity = capacity;
        }
    }


    public ArrayStack(int stackSize, int numStacks) {
        this.stackSize = stackSize;
        this.numStacks = numStacks;
        int totalSize = stackSize * numStacks;
        theStack = (T[]) new Object[totalSize];
        stackInfo = new StackInfo[numStacks];

        for (int i = 0; i < numStacks; i++) {
            stackInfo[i] = new StackInfo(i, stackSize);
        }
    }

    public void push(int whichStack, T toPush) {
        int i = whichStack - 1;
        theStack[stackInfo[i].top++] = toPush;
        if (i == numStacks - 1 && stackInfo[i].top + 1 == theStack.length) {
            resize();
        } else if (i < numStacks - 1 && stackInfo[i].top + 1 == stackInfo[i + 1].start) {
            resize();
        }
    }

    public T pop(int whichStack) {
        int i = whichStack - 1;
        T toReturn = theStack[stackInfo[i].top];
        theStack[stackInfo[i].top--] = null;
        return toReturn;
    }

    private void resize() {
        stackSize += 5;
        int totalSize = stackSize * numStacks;
        T[] newTheStack = (T[]) new Object[totalSize];
        ;
        StackInfo[] newStackInfo = new StackInfo[numStacks];

        for (int i = 0; i < numStacks; i++) {
            newStackInfo[i] = new StackInfo(i, stackSize);
            for (int j = stackInfo[i].start; j < stackInfo[i].top; j++) {
                newTheStack[(i * 5) + j] = theStack[j];
                newStackInfo[i].top++;
            }
        }
        theStack = newTheStack;
        stackInfo = newStackInfo;
    }

    public static void main(String[] args) {
        ArrayStack<Integer> test = new ArrayStack(2, 3);
        test.push(1, 10);
        test.push(1, 12);
        test.pop(1);
        test.push(1, 13);
        test.push(2, 13);
        test.push(2, 14);
        test.push(3, 12);
        test.push(3, 12);

        test.pop(1);
        test.pop(2);
        test.pop(3);
    }
}
