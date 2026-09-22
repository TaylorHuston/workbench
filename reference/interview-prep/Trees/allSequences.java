package Trees;

import java.util.LinkedList;

/*Print out all possible sequences that could have created this BST*/
public class AllSequences {
    public LinkedList<LinkedList<TreeNode>> allSeqs;

    public AllSequences(TreeNode root) {
        allSeqs = new LinkedList<>();
        LinkedList<TreeNode> pre = new LinkedList<>();
        LinkedList<TreeNode> poss = new LinkedList<>();

        buildSeqs(pre, poss, root);
        for (LinkedList<TreeNode> ll : allSeqs) {
            for (TreeNode n : ll) {
                System.out.print(n.data + " ");
            }
            System.out.println();
        }
    }

    private void buildSeqs(LinkedList<TreeNode> pre, LinkedList<TreeNode> poss, TreeNode root) {
        pre.add(root);
        if (root.left != null) {
            poss.add(root.left);
        }
        if (root.right != null) {
            poss.add(root.right);
        }

        if (poss.isEmpty()) {
            allSeqs.add(pre);
        }

        for (TreeNode n: poss) {
            LinkedList<TreeNode> temp = (LinkedList<TreeNode>) pre.clone();
            LinkedList<TreeNode> ptemp = (LinkedList<TreeNode>) poss.clone();
            ptemp.remove(n);
            buildSeqs(temp, ptemp, n);
        }
    }

    public static void main(String[] args) {
        TreeNode root = new TreeNode(10);
        root.left = new TreeNode(5);
        root.right = new TreeNode(15);
        root.left.right = new TreeNode(7);
        root.left.left = new TreeNode(3);

        AllSequences all = new AllSequences(root);
    }
}
