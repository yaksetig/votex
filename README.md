
# Votex

## Abstract
Online voting is hard (I wrote a bit about this [here](https://myaksetig.substack.com/p/on-the-security-of-online-voting)). Essentially, any approach that tries to solve online voting has to tackle the following: 

* **Privacy** - How each user votes should be private to external parties (ideally, even to the person running the election). 
* **Verifiability** - External parties should be able to audit and check whether or not the election was run correctly.
* **Coercion Resistance** - The scheme should have an integrated mechanism to prevent users from being bribed and/or coerced to cast their votes in a specific way.


### Real-World Coercion (or Bribing) Examples
 * An abusive person in a relationship can vote on behalf of their partner.
 * A professor running for a Dean position in a university colludes with the IT manager of the unviversity to see how each PhD student cast their vote. (Professor can subsequently work towards cancelling the funding of said students)
 * Blockchain nodes pay users to vote a specific way that favours the nodes. Users, acting rationally, cast the vote and make extra money.
 * 


## How does Votex tackle coercion and bribing? 
We take things a step further and assume that the user that is coerced/bribed actually gives the adversary a copy of their voting key. In other words, the bad actor can vote on behalf of the victim. However, we give users the ability to 'nullify' their vote. 

## Web App
Our app is live on the following URL: [https://votex.world](https://votex.world)

## How to create an election

### Step I 
You have to log in and prove that you are a human. The web app will display a QR code. Scan the QR code using your World App and prove that you are human.  

### Step II
You have to create a voting key. Go to dashboard and generate a new Baby jubjub keypair. 

### Step III
Go to the Elections tab and click "Create Election". 

### Step IV
Choose the title of the election. This should be short and catchy to ensure people can quickly understand what the election is about. For additional info, you can use the description field right below the title to add further context that users may want to see. 

### Step V
Click "Create Election". Your election is now live for everyone to see. 

## Additional Docs
* 2022 Short Paper - https://eprint.iacr.org/2022/1212.pdf
* 2024 Main Paper - https://eprint.iacr.org/2024/1354.pdf





