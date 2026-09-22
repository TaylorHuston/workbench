/**
 * Edge Weighted Graph implementation
 * Based on Algorithms, 4th Ed by Robert Sedgewick | Kevin Wayne
 */
public class EdgeWeightGraph {
    private int V;              //Number of vertices
    private int E;              //Number of edges
    private Queue<Edge>[] adj;  //Array of lists of adjacent vertices

    public EdgeWeightGraph(int V) {
        this.V = V;
        this.E = 0;
        adj = (Queue<Edge>[]) new Queue[V];
        for (int v = 0; v < V; v++) {
            adj[v] = new Queue<Edge>();
        }
    }

    public EdgeWeightGraph(In in) {
        this(in.readInt());
        int E = in.readInt();

        //Build all of the edges
        for (int i = 0; i < E; i++) {
            int v = in.readInt();
            int w = in.readInt();
            double weight = in.readDouble();
            Edge e = new Edge(v, w, weight);
            addEdge(e);
        }
    }

    public int V() {
        return V;
    }

    public int E() {
        return E;
    }

    //Add a new edge
    public void addEdge(Edge e) {
        int v = e.either();
        int w = e.other(v);
        adj[v].enqueue(e);
        adj[w].enqueue(e);
        E++;
    }

    //Edges adjacent to vertex v
    public Iterable<Edge> adj(int v) {
        return adj[v];
    }

    //All of the edges
   public Iterable<Edge> edges() {
       Queue<Edge> edges = new Queue<>();
       for (int v = 0; v < V; v++) {
           for (Edge e : adj[v]) {
               if (e.other(v) > v) {
                   edges.enqueue(e);
               }
           }
       }
       return edges;
   }

    public String toString() {
        StringBuilder s = new StringBuilder();
        s.append(V + " " + E + "\n");
        for (int v = 0; v < V; v++) {
            s.append(v + ": ");
            for (Edge e : adj[v]) {
                s.append(e + "  ");
            }
            s.append("\n");
        }
        return s.toString();
    }

    public static void main(String[] args) {
        In in = new In(args[0]);
        EdgeWeightGraph G = new EdgeWeightGraph(in);
        StdOut.println(G);

    }
}
