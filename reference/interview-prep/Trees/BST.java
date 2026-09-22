package Trees;

/**
 * Created by Taylor on 10/17/2015.
 */
public class BST {

    TreeNode head;

    public BST(int data) {
        head = new TreeNode(data);
    }

    public void add(int data) {
        add(data, head);
    }

    public void add (int data, TreeNode head) {
        if (data <= head.data) {
            if (head.left == null) {
                head.left = new TreeNode(data);
            } else {
                add(data, head.left);
            }
        } else {
            if (head.right == null) {
                head.right = new TreeNode(data);
            } else  {
                add(data, head.right);
            }
        }
    }

    public void printTree() {
        TreeNode.inOrder(head);
    }

    public static void main(String[] args) {
        BST myBST = new BST(10);
        myBST.add(5);
        myBST.add(3);
        myBST.add(6);
        myBST.add(20);
        myBST.add(25);
        myBST.add(15);
        myBST.printTree();

    }

}
