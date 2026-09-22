/**
 * Edge-Weighted Digraph
 * Based on Algorithms, 4th Ed by Robert Sedgewick | Kevin Wayne
 */
public class EdgeWeightedDigraph {
    private final int V;                //Number of vertices
    private int E;                       //Number of edges
    private Bag<DirectedEdge>[] adj;    //Adjacency lists for each vertext

    public EdgeWeightedDigraph(int V) {
        this.V = V;
        this.E = 0;
        adj = (Bag<DirectedEdge>[]) new Bag[V];

        for (int v = 0; v < V; v++) {
            adj[v] = new Bag<>();
        }
    }

    public EdgeWeightedDigraph(In in) {
        this(in.readInt());
        this.E = in.readInt();
        for (int i = 0; i < E; i++) {
            int from = in.readInt();
            int to = in.readInt();
            double weight = in.readDouble();
            addEdge(new DirectedEdge(from, to, weight));
        }
    }

    public int V() {
        return V;
    }

    public int E() {
        return E;
    }

    public void addEdge(DirectedEdge e) {
        adj[e.from()].add(e);
    }

    public Iterable<DirectedEdge> adj(int v) {
        return adj[v];
    }

    public Iterable<DirectedEdge> egdes() {
        Bag<DirectedEdge> toReturn = new Bag<>();

        for (int v = 0; v < V; v++) {
            for (DirectedEdge e : adj[v]) {
                toReturn.add(e);
            }
        }

        return toReturn;
    }

    public String toString() {
        StringBuilder s = new StringBuilder();
        s.append(V + " " + E + "\n");
        for (int v = 0; v < V; v++) {
            s.append(v + ": ");
            for (DirectedEdge e : adj[v]) {
                s.append(e + "  ");
            }
            s.append("\n");
        }
        return s.toString();
    }

    public static void main(String[] args) {
        In in = new In(args[0]);
        EdgeWeightedDigraph G = new EdgeWeightedDigraph(in);
        StdOut.println(G);
    }

}
