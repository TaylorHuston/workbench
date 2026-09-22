package LinkedList;

import java.util.HashSet;
import java.util.Random;
import java.util.Stack;

/*Basic Single Linked List implementation*/
public class LinkedList {

    public static class Node {
        public Node next;
        int data;

        Node(int data) {
            this.data = data;
            this.next = null;
        }

    }

    public Node head;

    LinkedList() {
        head = null;
    }

    public void addNode(int data) {
        if (head == null) {
            head = new Node(data);
        } else {
            Node pntr = head;
            while (pntr.next != null) {
                pntr = pntr.next;
            }
            pntr.next = new Node(data);
        }
    }

    //Delete all of the duplicate nodes in the LL using a buffer Hash
    public void deleteDupesHash() {
        HashSet<Integer> set = new HashSet<>();
        Node pntr = head;
        Node prev = null;
        while (pntr != null) {
            if (set.contains(pntr.data)) {
                prev.next = pntr.next;
            } else {
                set.add(pntr.data);
                prev = pntr;
            }
            pntr = pntr.next;
        }
    }

    //Delete all of the duplicates nodes in the LL without a buffer
    public void deleteDupesNoHash() {
        Node pntr = head;
        Node runner = null;

        while (pntr != null) {
            runner = pntr;
            while (runner.next != null) {
                if (runner.next.data == pntr.data) {
                    runner.next = runner.next.next;
                } else {
                    runner = runner.next;
                }
            }
            pntr = pntr.next;
        }
    }

    //Find the k-th from end element (k = 1 would be the last element)
    private class Index {
        public int val = 0;
    }

    public int findKthElement(int k) {
        if (head == null) {
            return 0;
        }
        Index index = new Index();
        Node temp = kthElement(head, k, index);
        return temp.data;
    }

    private Node kthElement(Node head, int k, Index index) {
        if (head == null) {
            return null;
        }
        Node temp = kthElement(head.next, k, index);
        index.val++;
        if (index.val == k) {
            return head;
        }
        return temp;
    }

    //Find the Kth element iteratively
    public int findKthIterative(int k) {
        Node p1 = head;
        Node p2 = head;

        for (int i = 0; i < k; i++) {
            if (p1 == null) {
                return 0;
            }
            p1 = p1.next;
        }

        while (p1 != null) {
            p1 = p1.next;
            p2 = p2.next;
        }

        return p2.data;
    }

    //Partion nodes around the node with the value of k
    public void Partition(int k) {
        Node beforeHead = null;
        Node beforeTail = null;
        Node afterHead = null;
        Node afterTail = null;

        Node pntr = head;

        while (pntr != null) {
            if (pntr.data < k) {
                if (beforeHead == null) {
                    beforeHead = new Node(pntr.data);
                    beforeTail = beforeHead;
                } else {
                    beforeTail.next = new Node(pntr.data);
                    beforeTail = beforeTail.next;
                }

            } else {
                if (afterHead == null) {
                    afterHead = new Node(pntr.data);
                    afterTail = afterHead;
                } else {
                    afterTail.next = new Node(pntr.data);
                    afterTail = afterTail.next;
                }
            }
            pntr = pntr.next;
        }
        beforeTail.next = afterHead;
        head = beforeHead;

    }

    //Add two numbers represented as linked lists in reverse order.
    public static int addListsReverse(LinkedList l1, LinkedList l2) {
        return addListsReverse(l1.head, l2.head, 0);
    }

    private static int addListsReverse(Node l1, Node l2, int place) {
        int sum = 0;

        if (place == 0) {
            place = 1;
        } else {
            place *= 10;
        }

        if (l1 != null) {
            sum += l1.data * place;
            l1 = l1.next;
        }

        if (l2 != null) {
            sum += l2.data * place;
            l2 = l2.next;
        }

        if (l1 != null || l2 != null) {
            sum += addListsReverse(l1, l2, place);
        }

        return sum;
    }

    //Add two number represented as linked lists in standard order.
    private static class LLSum {
        public int total = 0;
        public int place = 1;
    }

    public static int length(LinkedList ll) {
        int length = 0;
        Node pntr = ll.head;
        while (pntr != null) {
            length++;
            pntr = pntr.next;
        }
        return length;
    }

    public static void padd(LinkedList ll, int diff) {
        for (int i = 0; i < diff; i++) {
            Node temp = new Node(0);
            temp.next = ll.head;
            ll.head = temp;
        }
    }

    public static int addLists(LinkedList l1, LinkedList l2) {
        LLSum sum = new LLSum();
        int length1 = LinkedList.length(l1);
        int length2 = LinkedList.length(l2);
        int diff = length1 - length2;
        if (diff > 0) {
            LinkedList.padd(l2, diff);
        } else if (diff < 0) {
            LinkedList.padd(l1, -diff);
        }
        addLists(l1.head, l2.head, sum);

        return sum.total;

    }

    private static void addLists(Node l1, Node l2, LLSum sum) {
        if (l1.next != null) {
            addLists(l1.next, l2.next, sum);
        }
        sum.total += l1.data * sum.place;
        sum.total += l2.data * sum.place;
        sum.place *= 10;
    }


    //Check if it is a palindrome by comparing to the reverse of the list
    public LinkedList reverse() {
        LinkedList reversed = new LinkedList();
        reverse(head, reversed);
        return reversed;
    }

    private void reverse(Node head, LinkedList reversed) {
        if (head.next != null) {
            reverse(head.next, reversed);
        }
        reversed.addNode(head.data);
    }

    public boolean isPalindromReverse() {
        LinkedList reversed = this.reverse();

        Node l1 = head;
        Node l2 = reversed.head;
        Node runner = head;

        while (l1 != null) {
            if (l1.data != l2.data) {
                return false;
            }
            l1 = l1.next;
            l2 = l2.next;
        }

        return true;
    }

    //Check if it is a palindrome by using a Stack
    public boolean isPalindromStack() {
        Stack<Integer> tempStack = new Stack<>();
        Node pntr = head;

        while (pntr != null) {
            tempStack.push(pntr.data);
            pntr = pntr.next;
        }

        pntr = head;
        while (pntr != null) {
            if (pntr.data != tempStack.pop()) {
                return false;
            }
            pntr = pntr.next;
        }

        return true;
    }

    //Check to see if two LinkedLists intersect
    private static class Result {
        Node tail;
        int length;
    }

    private static void getTailAndLength(LinkedList ll, Result result) {
        Node pntr = ll.head;
        while (pntr.next != null) {
            result.length++;
            pntr = pntr.next;
        }

        result.tail = pntr;

    }

    public static int intersection(LinkedList l1, LinkedList l2) {
        Result r1 = new Result();
        Result r2 = new Result();

        getTailAndLength(l1, r1);
        getTailAndLength(l2, r2);

        if (r1.tail != r2.tail) {
            return -1;
        }

        Node h1 = l1.head;
        Node h2 = l2.head;

        if (r1.length > r2.length) {
            int diff = r1.length - r2.length;
            for (int i = 0; i < diff; i++) {
                h1 = h1.next;
            }
        } else if (r2.length > r1.length) {
            int diff = r2.length - r1.length;
            for (int i = 0; i < diff; i++) {
                h2 = h2.next;
            }
        }

        while (h1 != h2) {
            h1 = h1.next;
            h2 = h2.next;
        }

        return h1.data;
    }

    //Detect if a Linked List contains a loop, and if so, where is it
    public int loop() {
        Node slow = head; //Moves by one step
        Node fast = head; //Moves by two steps

        //Find where they collide
        while (fast != null && fast.next != null) {
            slow = slow.next;
            fast = fast.next.next;
            if (slow == fast) { //Collision
                break;
            }
        }

        //No loop
        if (fast == null || fast.next == null) {
            return -1;
        }

        //Find actual start of loop
        slow = head;
        while (slow != fast) {
            slow = slow.next;
            fast = fast.next;
        }

        return fast.data;
    }

    public String toString() {
        StringBuilder SB = new StringBuilder();
        Node pntr = head;
        while (pntr != null) {
            SB.append(pntr.data + " ");
            pntr = pntr.next;
        }
        return SB.toString();
    }

    public static void main(String[] args) {
        LinkedList LL = new LinkedList();
        Random RN = new Random();
        for (int i = 0; i < 30; i++) {
            int toAdd = RN.nextInt(10);
            LL.addNode(toAdd);
        }
        System.out.println(LL);

        System.out.println(LL.findKthElement(3));
        System.out.println(LL.findKthIterative(3));

        LL.Partition(7);
        System.out.println(LL);


        //LL.deleteDupesHash();
        LL.deleteDupesHash();
        System.out.println(LL);

//        LinkedList l1 = new LinkedList();
//        LinkedList l2 = new LinkedList();
//
//        l1.addNode(7);
//        l1.addNode(1);
//        l1.addNode(6);
//        l1.addNode(1);
//        l2.addNode(5);
//        l2.addNode(9);
//        l2.addNode(2);
//
//        System.out.println(LinkedList.addListsReverse(l1, l2));
//        System.out.println(LinkedList.addLists(l1, l2));
//
//        LinkedList palindrome = new LinkedList();
//        palindrome.addNode(1);
//        palindrome.addNode(2);
//        palindrome.addNode(3);
//        palindrome.addNode(2);
//        palindrome.addNode(1);
//
//        System.out.println(palindrome.isPalindromReverse());
//        System.out.println(palindrome.isPalindromStack());
//
//        palindrome = new LinkedList();
//        palindrome.addNode(1);
//        palindrome.addNode(2);
//        palindrome.addNode(3);
//        palindrome.addNode(3);
//        palindrome.addNode(2);
//        palindrome.addNode(1);
//
//        System.out.println(palindrome.isPalindromReverse());
//        System.out.println(palindrome.isPalindromStack());
//        palindrome.addNode(7);
//
//        System.out.println(palindrome.isPalindromReverse());
//        System.out.println(palindrome.isPalindromStack());
//
//
        LinkedList inter1 = new LinkedList();
        LinkedList inter2 = new LinkedList();

        for (int i = 0; i < 30; i++) {
            int toAdd = RN.nextInt(10);
            inter1.addNode(toAdd);
        }
        System.out.println(inter1);
        Node temp = inter1.head;

        for (int i = 0; i < 5; i++) {
            temp = temp.next;
        }

        inter2.head = temp;

        System.out.println(LinkedList.intersection(inter1, inter2));


        LinkedList hasLoop = new LinkedList();
        for (int i = 0; i < 30; i++) {
            int toAdd = RN.nextInt(10);
            hasLoop.addNode(toAdd);
        }

        Node loop = hasLoop.head;
        Node tail = hasLoop.head;

        for (int i = 0; i < 6; i++) {
            loop = loop.next;
        }

        while (tail.next != null) {
            tail = tail.next;
        }

        tail.next = loop;

        System.out.println(hasLoop.loop());

    }
}
