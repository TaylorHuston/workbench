package Trees;

import java.util.Stack;

/*Binary Tree Node*/
public class TreeNode {
    public int data;
    public TreeNode left;
    public TreeNode right;

    TreeNode(int data) {
        this.data = data;
    }

    TreeNode() {
        this(0);
    }

    public static void inOrder(TreeNode head) {
        if (head == null) {
            return;
        }
        inOrder(head.left);
        System.out.print(head.data + " ");
        inOrder(head.right);
    }

    public static void inOrderIterative(TreeNode head) {
        Stack<TreeNode> tempStack = new Stack<>();
        tempStack.push(head);
        TreeNode curr = head.left;

        while (tempStack.isEmpty() == false || curr != null) {
            while (curr != null) {
                tempStack.push(curr);
                curr = curr.left;
            }
            curr = tempStack.pop();
            System.out.print(curr.data + " ");
            curr = curr.right;
        }
    }

    public static void preOrder(TreeNode head) {
        if (head == null) {
            return;
        }
        System.out.print(head.data + " ");
        preOrder(head.left);
        preOrder(head.right);
    }

    public static void preOrderIterative(TreeNode head) {
        Stack<TreeNode> tempStack = new Stack<>();
        tempStack.push(head);
        TreeNode curr;

        while (tempStack.isEmpty() == false) {
            curr = tempStack.pop();
            System.out.print(curr.data + " ");
            if (curr.right != null) {
                tempStack.push(curr.right);
            }

            if (curr.left != null) {
                tempStack.push(curr.left);
            }
        }
    }

    public static void postOrder(TreeNode head) {
        if (head == null) {
            return;
        }
        postOrder(head.left);
        postOrder(head.right);
        System.out.print(head.data + " ");
    }

    public static void postOrderIterative(TreeNode head) {
        Stack<TreeNode> tempStack = new Stack<>();
        Stack<TreeNode> tempStack2 = new Stack<>();
        tempStack.push(head);
        TreeNode curr;

        while (tempStack.isEmpty() == false) {
            curr = tempStack.pop();
            tempStack2.push(curr);
            if (curr.left != null) {
                tempStack.push(curr.left);
            }
            if (curr.right != null) {
                tempStack.push(curr.right);
            }
        }

        while (tempStack2.isEmpty() == false) {
            System.out.print(tempStack2.pop().data + " ");
        }
    }

    public static void main(String[] args) {
        TreeNode head = new TreeNode(1);
        head.left = new TreeNode(2);
        head.right = new TreeNode(3);
        head.left.left = new TreeNode(4);
        head.left.right = new TreeNode(5);

        TreeNode.inOrder(head);
        System.out.println();
        TreeNode.inOrderIterative(head);
        System.out.println();
        TreeNode.preOrder(head);
        System.out.println();
        TreeNode.preOrderIterative(head);
        System.out.println();
        TreeNode.postOrder(head);
        System.out.println();
        TreeNode.postOrderIterative(head);
        System.out.println();

    }

}
