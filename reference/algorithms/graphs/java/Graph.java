/**
 * Undirected Graph implementation
 * Based on Algorithms, 4th Ed by Robert Sedgewick | Kevin Wayne
 */
public class Graph {

    protected final int V; //# of vertices
    protected int E; //# of edges
    protected Bag<Integer>[] adjLists;  //Array of adjacency lists

    //Constructor with a pre-supplied number of vertices
    Graph(int V) {
        this.V = V;
        this.E = 0;
        adjLists = (Bag<Integer>[]) new Bag[V];

        for (int i = 0; i < V; i++) {
            adjLists[i] = new Bag<Integer>();
        }

    }

    //Constructor with a graph built from input stream
    Graph(In in) {
        this(in.readInt());
        int E = in.readInt();

        for (int i = 0; i < E; i++) {
            int first = in.readInt();
            int second = in.readInt();
            addEdge(first, second);
        }

    }

    //Number of vertices
    public int V() {
        return V;
    }

    //Number of edges
    public int E() {
        return E;
    }

    //Connect two vertices (first to second)
    public void addEdge(int first, int second) {
        adjLists[first].add(second);
        adjLists[second].add(first);
        E++;
    }

    //Retrieve iterable list of vertices adjacent to vertex
    public Iterable<Integer> adj(int vertex) {
        return adjLists[vertex];
    }

    public String toString() {
        String s = V + " vertices, " + E + " edges\n";

        for (int v = 0; v < V; v++) {
            s += v + ": ";
            for (int e : this.adj(v)) {
                s += e + " ";
            }
            s += "\n";
        }
        return s;
    }

    public static void main(String[] args) {
        In in = new In(args[0]);
        Graph UD = new Graph(in);

        StdOut.println("Generated Undirected Graph:");
        StdOut.println(UD);
        StdOut.println("Degree of vertex 3 is " + degree(UD, 3));
        StdOut.println("Max degree is " + maxDegree(UD));
        StdOut.println("Average degree is " + averageDegree(UD));

        DepthFirst dfs = new DepthFirst(UD, 12);
        StdOut.println("Depth First Path from vertex 12 to vertex 9: " + dfs.pathTo(9));
        dfs = new DepthFirst(UD, 9);
        StdOut.println("Depth First Path from vertex 9 to vertex 12: " + dfs.pathTo(12));
        BreadthFirst bfs = new BreadthFirst(UD, 9);
        StdOut.println("Shortest Path from vertex 9 to vertex 12: " + bfs.pathTo(12));
        StdOut.println();

        ConnectedComponents cc = new ConnectedComponents(UD);
        int count = cc.count();

        StdOut.println("There are " + count + " connected components:");
        Queue<Integer>[] comps = (Queue<Integer>[]) new Queue[count];

        for (int i = 0; i < count; i++) {
            comps[i] = new Queue<Integer>();
        }

        for (int v = 0; v < UD.V(); v++) {
            comps[cc.id(v)].enqueue(v);
        }

        for (int i = 0; i < count; i++) {
            for (int v : comps[i]) {
                StdOut.print(v + " ");
            }
            StdOut.println();
        }

    }

    //Computer the degree of vertex V
    public static int degree(Graph G, int V) {
        int degree = 0;
        for (int w : G.adj(V)) {
            degree++;
        }
        return degree;
    }

    //Find the vertex with the largest degree
    public static int maxDegree(Graph G) {
        int max = 0;
        for (int v = 0; v < G.V(); v++) {
            int temp = degree(G, v);
            if (temp > max) {
                max = temp;
            }
        }
        return max;
    }

    //Compute the average degree
    public static double averageDegree(Graph G) {
        return (2.0 * G.E() / G.V());
    }
}
