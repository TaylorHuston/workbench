/**
 * Calculates the preorder, postorder and reverse postorder of the vertices in a Directed Graph
 * Based on Algorithms, 4th Ed by Robert Sedgewick | Kevin Wayne
 */
public class DepthOrder {
    private boolean[] marked;           //Keep track of already visited vertices
    private Queue<Integer> pre;         //Vertices in preorder
    private Queue<Integer> post;        //Vertices in postorder
    private Stack<Integer> reversePost; //Vertices in reverse postorder

    public DepthOrder(Digraph G) {
        pre         = new Queue<>();
        post        = new Queue<>();
        reversePost = new Stack<>();
        marked      = new boolean[G.V()];

        for (int v = 0; v < G.V(); v++) {
            if (marked[v] == false) {
                dfs(G, v);
            }
        }
    }

    //Recursively traverse each path until you reach a 'dead end'
    private void dfs(Graph G, int current) {
        pre.enqueue(current);
        marked[current] = true;

        for (int next : G.adj(current)) {
            if (marked[next] == false) {
                dfs(G, next);
            }
        }
        post.enqueue(current);
        reversePost.push(current);
    }

    //Return the various sorted orders
    public Iterable<Integer> pre() {
        return pre;
    }
    public Iterable<Integer> post() {
        return post;
    }
    public Iterable<Integer> reversePost() {
        return reversePost;
    }
}
