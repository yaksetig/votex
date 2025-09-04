
# Votex

## Abstract
Online voting is hard (I wrote a bit about this [here](https://myaksetig.substack.com/p/on-the-security-of-online-voting)). Essentially, any approach that tries to do online voting has to tackle the following: 

* **Privacy** - How each user votes should be private to external parties (ideally, even to the person running the election). 
* **Verifiability** - External parties should be able to audit and check whether or not the election was run correctly.
* **Coercion Resistance** - The scheme should have an integrated mechanism to prevent users from being bribed and/or coerced to cast their votes in a specific way.


### Real-World Coercion (or Bribing) Examples
 * An abusive person in a relationship can vote on behalf of their partner.
 * A professor running for a Dean position in a university colludes with the IT manager of the unviversity to see how each PhD student cast their vote. (Professor can subsequently work towards cancelling the funding of said students)
 * Blockchain nodes pay users to vote a specific way that favours the nodes. Users, acting rationally, cast the vote and make extra money. 


## How does Votex tackle coercion and bribing? 
We take things a step further and assume that the user that is coerced/bribed actually gives the adversary a copy of their voting key. In other words, the bad actor can vote on behalf of the victim. However, we give users the ability to 'nullify' their vote. As long as the user is able to safely generate and register the initial keypair, they are set. 

## Doesn't MACI solve this? 
Not really. Assume the following scenario: Bob generates a voting keypair and votes 'YES'. The coercer/briber forces Bob to cast a specific payload including a key that only they control. Bob is then no longer able to cancel the vote and has successfully been coerced/bribed. If you assume a very strong model where the key is generated correctly and given to the adversary so that the adversary can cast the immediate first vote on behalf of the user, then MACI fails. This may sound very extreme, but it's actually a pretty realistic adversary model (especially for the Web3 world). 

## Blockchain Governance is far from the 'real deal'
DAO Elections are currently the worst of all worlds. Although they do provide auditability (as anyone can go and check the blockchain and the corresponding smart contract for the votes), the votes are public and adversaries can coerce/bribe the voters. It's not infrequent for community members to be revolted after seeing how specific users and/or team members are voting in specific elections. This violates a fundamental human right when it comes to voting. 

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

## Future Work
Presently, the system already masks which user is voting via the use of ZK-SNARKs. However, an advanced adversary may be able to infer additional information about the voter from their metadata (e.g., IP address). Adding an additional hiding layer in the submission process remains as future work. Additionally, the system is currently implemented to show a real-time tally (aka a running tally). Many governments do not allow a real-world election system to operate in this manner. Therefore, one of the tasks at hand is to allow for an instantiation of the system where this running tally is not leaked in real-time and is only displayed at the end of the election. We highlight that even without a live running tally, the user must be able to check that their vote was correctly cast to ensure that their vote will be counted in the election.  



