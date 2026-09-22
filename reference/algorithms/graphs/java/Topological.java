/**
 * Calculates the Topological Sort of a Directed Acyclic Graph
 * Based on Algorithms, 4th Ed by Robert Sedgewick | Kevin Wayne
 */
public class Topological {
    private Iterable<Integer> order;    //The topological order

    public Topological(Digraph G) {
        DirectedCycle dc = new DirectedCycle(G);
        //Graphs with cycles cannot have a topological sort
        if (dc.hasCycle() == false) {
            DepthOrder df = new DepthOrder(G);
            order = df.reversePost();
        }
    }

    public Iterable<Integer> order() {
        return order;
    }

    public boolean isDAG() {
        return order != null;
    }
}
