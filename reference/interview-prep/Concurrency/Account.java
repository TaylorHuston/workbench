package Concurrency;

/*A hypothetical thread-safe Bank Account class*/
public class Account {
    private int accountNumber;
    private double balance; //Would not use double for this in the real world
    String lastName;
    String firstName;

    public synchronized boolean deposit (double amount) {
        if (amount < 0.0) {
            return false;
        } else {
            balance += amount;
            return true;
        }
    }

    public synchronized boolean withdraw(double amount) {
        if (amount < 0.0 || balance < amount) {
            return false;
        } else  {
            balance -= amount;
            return true;
        }
    }
}
