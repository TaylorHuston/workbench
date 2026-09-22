/**
 * Directed Graph implementation
 * Based on Algorithms, 4th Ed by Robert Sedgewick | Kevin Wayne
 */
public class Digraph extends Graph {
    Digraph(int V) {
        super(V);
    }

    Digraph(In in) {
        this(in.readInt());
        int E = in.readInt();

        for (int i = 0; i < E; i++) {
            int first = in.readInt();
            int second = in.readInt();
            addEdge(first, second);
        }
    }

    public void addEdge(int first, int second) {
        adjLists[first].add(second);
        E++;
    }

    //Return this graph with all of the edges reversed
    public Digraph reverse() {
        Digraph R = new Digraph(V);
        for (int v = 0; v < V; v++) {
            for (int w : adj(v)) {
                R.addEdge(w, v);
            }
        }
        return R;
    }

    public String toString() {
        String s = V + " vertices, " + E + " edges\n";

        for (int v = 0; v < V; v++) {
            for (int e : this.adj(v)) {
                s += v + " -> " + e + "\n";
            }
        }
        return s;
    }


    public static void main(String args[]) {
        In in = new In(args[0]);
        Digraph DG = new Digraph(in);
        StdOut.println("Generated Directed Graph:");
        StdOut.println(DG);
        Digraph RDG = DG.reverse();
        StdOut.println(RDG);

        DirectedCycle hasCycle = new DirectedCycle(DG);
        StdOut.println("This Directed Graph contains a cycle: " + hasCycle.hasCycle());

        DepthOrder sorted = new DepthOrder(DG);
        StdOut.println("Preorder: " + sorted.pre());
        StdOut.println("Postorder: " + sorted.post());
        StdOut.println("Reverse Postorder: " + sorted.reversePost());

        Topological topSort = new Topological(DG);
        if (topSort.isDAG() == true) {
            StdOut.println("Topological sort: " + topSort.order());
        }

        KosarajuSharirSCC scc = new KosarajuSharirSCC(DG);
        // number of connected components
        int M = scc.count();
        StdOut.println(M + " components");

        // compute list of vertices in each strong component
        Queue<Integer>[] components = (Queue<Integer>[]) new Queue[M];
        for (int i = 0; i < M; i++) {
            components[i] = new Queue<Integer>();
        }
        for (int v = 0; v < DG.V(); v++) {
            components[scc.id(v)].enqueue(v);
        }

        // print results
        for (int i = 0; i < M; i++) {
            for (int v : components[i]) {
                StdOut.print(v + " ");
            }
            StdOut.println();
        }


    }
}

