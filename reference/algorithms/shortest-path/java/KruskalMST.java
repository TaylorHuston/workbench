/**
 * Kruskal's MST algorithm
 * Based on Algorithms, 4th Ed by Robert Sedgewick | Kevin Wayne
 */
public class KruskalMST {
    private Queue<Edge> mst;    //Edges in the MST
    private MinPQ<Edge> edges;  //Edges not yet in the MST
    private UF uf;              //To connect the trees
    private double weight;      //Total weight of the MST


    public KruskalMST(EdgeWeightGraph G) {
        mst = new Queue<>();
        edges = new MinPQ<>();
        uf = new UF(G.V());
        weight = 0;

        //Build the initial list of edges
        for (Edge e: G.edges()) {
            edges.insert(e);
        }

        //Iterate through and build the MST
        while (!edges.isEmpty()) {
            Edge e = edges.delMin();    //The smallest unused edge
            int v = e.either();         //First vertex
            int w = e.other(v);         //Second vertex

            if (!uf.connected(v, w)) {  //If these two vertices aren't already in the tree
                uf.union(v ,w);         //Add the new vertex to the tree
                mst.enqueue(e);         //Add the edge to the mst
                weight += e.weight();   //Add the weight of the edge
            }
        }
    }

    public Iterable<Edge> edges() {
        return mst;
    }

    public double weight() {
        return weight;
    }

    public static void main(String[] args) {
        In in = new In(args[0]);
        EdgeWeightGraph G = new EdgeWeightGraph(in);
        KruskalMST mst = new KruskalMST(G);
        for (Edge e : mst.edges()) {
            StdOut.println(e);
        }
        StdOut.printf("%.5f\n", mst.weight());
    }
}
