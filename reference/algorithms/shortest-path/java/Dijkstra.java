/**
 * Dijkstra's Algoriothm for finding the shortest path
 * Based on Algorithms, 4th Ed by Robert Sedgewick | Kevin Wayne
 */
public class Dijkstra {
    private DirectedEdge[] edgeTo;  //For vertex i, edgeTo[i] is the previous vertex in the shortest path
    private double[] distTo;        //For vertex i, distTo[i] is the distance from the source
    private IndexMinPQ<Double> pq;  //Priority queue of the vertices to check, in order

    public Dijkstra(EdgeWeightedDigraph G, int source) {
        edgeTo = new DirectedEdge[G.V()];
        distTo = new double[G.V()];
        pq = new IndexMinPQ<>((G.V()));

        //Set up all of the distances to initially be infinite
        for (int v = 0; v < G.V(); v++) {
            distTo[v] = Double.POSITIVE_INFINITY;
        }
        distTo[source] = 0.0;

        pq.insert(source, 0.0);

        //Grab the vertex of the next priority and see if it shortens the path
        while(!pq.isEmpty()) {
            relax(G, pq.delMin());
        }
    }

    //Check to see if any of the edges adjacent to v create a new shortest path
    private void relax(EdgeWeightedDigraph G, int v) {
        for (DirectedEdge e : G.adj(v)) {
            int w = e.to();
            //Is the current distance to w from the source greater than the new distance if you come from v instead?
            //If so, update the distance and path to w to reflect it's new shorter path
            if (distTo[w] > distTo[v] + e.weight()) {
                distTo[w] = distTo[v] + e.weight(); //New distance
                edgeTo[w] = e;                      //New path

                //If w was already in the priority queue update it's priority, else add it to the priority queue
                if (pq.contains(w)) {
                    pq.changeKey(w, distTo[w]);
                } else {
                    pq.insert(w, distTo[w]);
                }
            }
        }
    }

    public double distTo(int v) {
        return distTo[v];
    }

    public boolean hasPathTo(int v) {
        return distTo[v] < Double.POSITIVE_INFINITY;
    }

    public Iterable<DirectedEdge> pathTo(int v) {
        if (!hasPathTo(v)) return null;
        Stack<DirectedEdge> path = new Stack<DirectedEdge>();
        for (DirectedEdge e = edgeTo[v]; e != null; e = edgeTo[e.from()]) {
            path.push(e);
        }
        return path;
    }

    public static void main(String[] args) {
        In in = new In(args[0]);
        EdgeWeightedDigraph G = new EdgeWeightedDigraph(in);
        int s = Integer.parseInt(args[1]);

        Dijkstra sp = new Dijkstra(G, s);

        for (int t = 0; t < G.V(); t++) {
            if (sp.hasPathTo(t)) {
                StdOut.printf("%d to %d (%.2f)  ", s, t, sp.distTo(t));
                for (DirectedEdge e : sp.pathTo(t)) {
                    StdOut.print(e + "   ");
                }
                StdOut.println();
            } else {
                StdOut.printf("%d to %d         no path\n", s, t);
            }
        }
    }
}
