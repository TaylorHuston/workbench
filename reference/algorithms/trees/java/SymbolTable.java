/**
 * Created by Taylor on 3/13/2015.
 */
public class SymbolTable<Key extends Comparable<Key>, Val> {

    SymbolTable() {

    }

    public static void main(String[] args) {
        SymbolTable<String, Integer> st;
        st = new SymbolTable<String, Integer>();

        for (int i = 0; !StdIn.isEmpty(); i++) {
            String key = StdIn.readString();
            st.put(key, i);
        }

        for (String s : st.kess()) {
            StdOut.println(s + " " + st.get(s));
        }
    }
}
