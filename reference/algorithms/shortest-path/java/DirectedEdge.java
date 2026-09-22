/**
 * Directed Edge for a Edge-Weighted Digraph
 * Based on Algorithms, 4th Ed by Robert Sedgewick | Kevin Wayne
 */
public class DirectedEdge {
    private final int from;         //Start of edge
    private final int to;           //End of edge
    private final double weight;    //Weight of this edge

    public DirectedEdge(int from, int to, double weight) {
        this.from = from;
        this.to = to;
        this.weight = weight;
    }

    public double weight() {
        return weight;
    }

    public int from() {
        return from;
    }

    public int to() {
        return to;
    }

    public String toString() {
        return String.format("%d->%d %.2f", from, to, weight);
    }

    public static void main(String[] args) {
        DirectedEdge someEdge = new DirectedEdge(10,12,47.3);
        StdOut.println("From: " + someEdge.from());
        StdOut.println("To: " + someEdge.to());
        StdOut.println("Weight: " + someEdge.weight());
        StdOut.println("Edge: " + someEdge);

    }
}
