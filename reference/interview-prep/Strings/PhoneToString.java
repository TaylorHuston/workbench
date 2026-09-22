package Strings;

/*Get all possible word combinations from a phone numer*/
public class PhoneToString {
    StringBuilder out = new StringBuilder();
    private int[] phoneNum;

    public PhoneToString(int[] n) {
        phoneNum = n;
        convert(0);
    }

    private void convert(int place) {
        if (place >= phoneNum.length) {
            System.out.println(out);
        } else {
            for (int i = 0; i < 3; i++) {
                out.append(numToChar(phoneNum[place], i));
                convert(place + 1);
                out.setLength(out.length() - 1);
            }
        }
    }

    private char numToChar(int num, int place) {
        char[][] key = new char[9][3];
        key[1][0] = 'a';
        key[1][1] = 'b';
        key[1][2] = 'c';

        key[2][0] = 'd';
        key[2][1] = 'e';
        key[2][2] = 'f';

        key[3][0] = 'g';
        key[3][1] = 'h';
        key[3][2] = 'i';

        key[4][0] = 'j';
        key[4][1] = 'k';
        key[4][2] = 'l';

        key[5][0] = 'm';
        key[5][1] = 'n';
        key[5][2] = 'o';

        key[6][0] = 'p';
        key[6][1] = 'r';
        key[6][2] = 's';

        key[7][0] = 't';
        key[7][1] = 'u';
        key[7][2] = 'v';

        key[8][0] = 'w';
        key[8][1] = 'x';
        key[8][2] = 'y';

        return key[num-1][place];
    }

    public static void main(String[] args) {
        int[] phoneNum = {4,9,7,1,9,2,7};
        PhoneToString ph = new PhoneToString(phoneNum);
    }
}
