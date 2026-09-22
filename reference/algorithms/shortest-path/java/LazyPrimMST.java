/**
 * So-called 'lazy' version of Prim's MST algorithm
 * Based on Algorithms, 4th Ed by Robert Sedgewick | Kevin Wayne
 */
public class LazyPrimMST {
    private boolean[] inTree;               //Vertices in the MST
    private Queue<Edge> mst;                //Edges in the MST
    private MinPQ<Edge> crossingEdges;      //Crossing edges between MST and other vertices
    private double weight;                  //Total weight of the MST

    public LazyPrimMST(EdgeWeightGraph G) {
        crossingEdges = new MinPQ<>();
        inTree = new boolean[G.V()];
        mst = new Queue<>();
        weight = 0;

        visit(G,0);
        while (!crossingEdges.isEmpty()) {
            Edge e = crossingEdges.delMin();    //Smallest unused edge
            int v = e.either();                 //First vertex
            int w = e.other(v);                 //Second vertex
            if (inTree[v] && inTree[w]) {       //Lazy, skip if both vertices are already in tree
                continue;
            }
            mst.enqueue(e);                     //Add edge to the MST
            weight += e.weight();
            if (!inTree[v]) {                   //Visit whichever vertex wasn't in the MST
                visit(G, v);
            }
            if (!inTree[w]) {
                visit(G, w);
            }

        }
    }

    //Mark the vertex and add all of it's edges as potential crossing edges
    private void visit(EdgeWeightGraph G, int v) {
        inTree[v] = true;

        for (Edge e: G.adj(v)) {
            if (!inTree[e.other(v)]) {
                crossingEdges.insert(e);
            }
        }
    }

    public double weight() {
        return weight;
    }

    public Iterable<Edge> edges() {
        return mst;
    }

    public static void main(String[] args) {
        In in = new In(args[0]);
        EdgeWeightGraph G = new EdgeWeightGraph(in);
        LazyPrimMST mst = new LazyPrimMST(G);
        for (Edge e : mst.edges()) {
            StdOut.println(e);
        }
        StdOut.printf("%.5f\n", mst.weight());
    }

}
